import { createReadStream } from "node:fs";
import { access, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { extractSpotifyPlaylist } from "./src/lib/extract_spotify_playlist.mjs";
import { renderPlaylistPages } from "./src/lib/render_playlist.mjs";
import { normalizeSpotifyPlaylistInput } from "./src/lib/spotify.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number.parseInt(process.env.PORT || "3000", 10);
const OUTPUT_DIR = path.resolve(process.env.PLAYLIST_OUTPUT_DIR || path.join(__dirname, "playlists"));
const INDEX_FILE = path.join(__dirname, "index.html");
const ASSETS_DIR = path.join(__dirname, "assets");

const MIME_TYPES = {
	".css": "text/css; charset=utf-8",
	".html": "text/html; charset=utf-8",
	".ico": "image/x-icon",
	".jpeg": "image/jpeg",
	".jpg": "image/jpeg",
	".js": "application/javascript; charset=utf-8",
	".json": "application/json; charset=utf-8",
	".png": "image/png",
	".svg": "image/svg+xml",
	".txt": "text/plain; charset=utf-8",
	".webp": "image/webp",
	".xml": "application/xml; charset=utf-8",
};

const nowIso = () => new Date().toISOString();

const json = (response, status, body) => {
	response.writeHead(status, {
		"Content-Type": "application/json; charset=utf-8",
	});
	response.end(JSON.stringify(body));
};

const sendFile = async (response, filePath) => {
	const fileStat = await stat(filePath);
	const extension = path.extname(filePath).toLowerCase();
	const mimeType = MIME_TYPES[extension] || "application/octet-stream";

	response.writeHead(200, {
		"Content-Type": mimeType,
		"Content-Length": fileStat.size,
	});

	await new Promise((resolve, reject) => {
		const stream = createReadStream(filePath);
		stream.on("error", reject);
		stream.on("end", resolve);
		stream.pipe(response);
	});
};

const readJsonBody = async (request) => {
	const chunks = [];
	for await (const chunk of request) {
		chunks.push(chunk);
	}

	if (chunks.length === 0) {
		return {};
	}

	return JSON.parse(Buffer.concat(chunks).toString("utf8"));
};

const ensureInside = (rootDir, requestedPath) => {
	const resolvedRoot = path.resolve(rootDir);
	const resolvedPath = path.resolve(requestedPath);

	if (resolvedPath === resolvedRoot || resolvedPath.startsWith(`${resolvedRoot}${path.sep}`)) {
		return resolvedPath;
	}

	return null;
};

const writePlaylistFiles = async (playlistId, pages) => {
	const playlistDir = path.join(OUTPUT_DIR, playlistId);
	await mkdir(playlistDir, { recursive: true });
	await Promise.all([
		writeFile(path.join(playlistDir, "index.html"), pages.indexHtml, "utf8"),
		writeFile(path.join(playlistDir, "artists.html"), pages.artistsHtml, "utf8"),
	]);
};

const handleBuild = async (request, response) => {
	let body;
	try {
		body = await readJsonBody(request);
	} catch {
		json(response, 400, {
			ok: false,
			error: "Invalid JSON body.",
		});
		return;
	}

	const normalized = normalizeSpotifyPlaylistInput(body?.playlist_url || body?.playlist_id);
	if (!normalized) {
		json(response, 400, {
			ok: false,
			error: "A valid Spotify playlist URL is required.",
		});
		return;
	}

	try {
		const playlist = await extractSpotifyPlaylist(normalized.playlistUrl);
		const pages = await renderPlaylistPages(playlist);
		await writePlaylistFiles(normalized.playlistId, pages);

		json(response, 200, {
			ok: true,
			playlist_id: normalized.playlistId,
			playlist_url: playlist.url || normalized.playlistUrl,
			public_url: `/playlists/${normalized.playlistId}/`,
			status: "complete",
			message: "Playlist build completed.",
			error: "",
			track_count: playlist.tracks.length,
			updated_at: nowIso(),
		});
	} catch (error) {
		json(response, 500, {
			ok: false,
			playlist_id: normalized.playlistId,
			playlist_url: normalized.playlistUrl,
			public_url: `/playlists/${normalized.playlistId}/`,
			status: "failed",
			message: "Playlist build failed.",
			error: error instanceof Error ? error.message : String(error),
			track_count: 0,
			updated_at: nowIso(),
		});
	}
};

const server = http.createServer(async (request, response) => {
	const url = new URL(request.url || "/", `http://${request.headers.host || "127.0.0.1"}`);

	try {
		if (request.method === "GET" && url.pathname === "/") {
			await sendFile(response, INDEX_FILE);
			return;
		}

		if (request.method === "POST" && url.pathname === "/api/build") {
			await handleBuild(request, response);
			return;
		}

		if (request.method === "GET" && url.pathname.startsWith("/assets/")) {
			const relativePath = url.pathname.slice("/assets/".length);
			const filePath = ensureInside(ASSETS_DIR, path.join(ASSETS_DIR, relativePath));
			if (!filePath) {
				json(response, 404, { ok: false, error: "Not found." });
				return;
			}
			await access(filePath);
			await sendFile(response, filePath);
			return;
		}

		if (request.method === "GET" && url.pathname.startsWith("/playlists/")) {
			const playlistPath = url.pathname.replace(/^\/playlists\//, "");
			const relativePath = playlistPath.endsWith("/")
				? path.join(playlistPath, "index.html")
				: playlistPath;
			const filePath = ensureInside(OUTPUT_DIR, path.join(OUTPUT_DIR, relativePath));
			if (!filePath) {
				json(response, 404, { ok: false, error: "Not found." });
				return;
			}
			await access(filePath);
			await sendFile(response, filePath);
			return;
		}

		response.writeHead(404, {
			"Content-Type": "text/plain; charset=utf-8",
		});
		response.end("Not found");
	} catch (error) {
		if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
			response.writeHead(404, {
				"Content-Type": "text/plain; charset=utf-8",
			});
			response.end("Not found");
			return;
		}

		response.writeHead(500, {
			"Content-Type": "application/json; charset=utf-8",
		});
		response.end(JSON.stringify({
			ok: false,
			error: error instanceof Error ? error.message : String(error),
		}));
	}
});

await mkdir(OUTPUT_DIR, { recursive: true });
server.listen(PORT, () => {
	console.log(`Mews server listening on http://127.0.0.1:${PORT}`);
	console.log(`Playlist output directory: ${OUTPUT_DIR}`);
});
