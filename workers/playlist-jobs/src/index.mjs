import { extractSpotifyPlaylist } from "../../../src/lib/extract_spotify_playlist_cloudflare.mjs";
import { playlistToXml } from "../../../src/lib/playlist_xml.mjs";
import { renderPlaylistPages } from "../../../src/lib/render_playlist.mjs";
import { normalizeSpotifyPlaylistInput } from "../../../src/lib/spotify.mjs";

const nowIso = () => new Date().toISOString();

const buildStateResponse = (state, init = {}) =>
	new Response(JSON.stringify(state), {
		status: init.status || 200,
		headers: {
			"Content-Type": "application/json; charset=utf-8",
			...(init.headers || {}),
		},
	});

const defaultJobState = (playlistId = "") => ({
	playlist_id: playlistId,
	playlist_url: playlistId ? `https://open.spotify.com/playlist/${playlistId}` : "",
	public_url: playlistId ? `/playlists/${playlistId}/` : "",
	status: "idle",
	message: "",
	error: "",
	track_count: 0,
	updated_at: nowIso(),
});

export class PlaylistJob {
	constructor(state, env) {
		this.state = state;
		this.env = env;
	}

	async fetch(request) {
		const url = new URL(request.url);

		if (request.method === "GET" && url.pathname === "/status") {
			return this.handleStatus();
		}

		if (request.method === "POST" && url.pathname === "/build") {
			return this.handleBuild(request);
		}

		return new Response("Not found", { status: 404 });
	}

	async alarm() {
		const job = await this.getState();
		if (job.status !== "queued") {
			return;
		}

		await this.setState({
			...job,
			status: "running",
			message: "Extracting playlist from Spotify.",
			error: "",
			updated_at: nowIso(),
		});

		try {
			const extracted = await extractSpotifyPlaylist(this.env.BROWSER, job.playlist_id);
			const xml = playlistToXml(extracted);
			const pages = await renderPlaylistPages(xml);

			await Promise.all([
				this.env.PLAYLIST_BUCKET.put(`playlists/${job.playlist_id}/index.html`, pages.indexHtml, {
					httpMetadata: {
						contentType: "text/html; charset=utf-8",
					},
				}),
				this.env.PLAYLIST_BUCKET.put(`playlists/${job.playlist_id}/artists.html`, pages.artistsHtml, {
					httpMetadata: {
						contentType: "text/html; charset=utf-8",
					},
				}),
			]);

			await this.setState({
				playlist_id: job.playlist_id,
				playlist_url: extracted.url || job.playlist_url,
				public_url: `/playlists/${job.playlist_id}/`,
				status: "complete",
				message: "Playlist build completed.",
				error: "",
				track_count: extracted.tracks.length,
				updated_at: nowIso(),
			});
		} catch (error) {
			await this.setState({
				...job,
				status: "failed",
				message: "Playlist build failed.",
				error: error instanceof Error ? error.message : String(error),
				updated_at: nowIso(),
			});
		}
	}

	async handleStatus() {
		return buildStateResponse(await this.getState());
	}

	async handleBuild(request) {
		const body = await request.json();
		const normalized = normalizeSpotifyPlaylistInput(body?.playlist_url || body?.playlist_id);
		if (!normalized) {
			return buildStateResponse({
				ok: false,
				error: "A valid Spotify playlist URL is required.",
			}, { status: 400 });
		}

		const current = await this.getState(normalized.playlistId);
		const nextState = {
			...current,
			playlist_id: normalized.playlistId,
			playlist_url: normalized.playlistUrl,
			public_url: `/playlists/${normalized.playlistId}/`,
			status: current.status === "running" ? "running" : "queued",
			message: current.status === "running" ? "Build already running." : "Build queued.",
			error: "",
			updated_at: nowIso(),
		};

		await this.setState(nextState);

		if (current.status !== "running") {
			await this.state.storage.setAlarm(Date.now());
		}

		return buildStateResponse({
			ok: true,
			...nextState,
		}, { status: 202 });
	}

	async getState(fallbackPlaylistId = "") {
		const stored = await this.state.storage.get("job");
		return stored || defaultJobState(fallbackPlaylistId);
	}

	async setState(value) {
		await this.state.storage.put("job", value);
	}
}

export class RateLimitBucket {
	constructor(state) {
		this.state = state;
	}

	async fetch(request) {
		if (request.method !== "POST") {
			return new Response("Method not allowed", { status: 405 });
		}

		const body = await request.json();
		const maxRequests = Number(body?.maxRequests || 5);
		const windowMs = Number(body?.windowMs || 600000);
		const now = Date.now();
		const bucket = (await this.state.storage.get("bucket")) || {
			window_started_at: now,
			count: 0,
		};

		if (now - bucket.window_started_at >= windowMs) {
			bucket.window_started_at = now;
			bucket.count = 0;
		}

		if (bucket.count >= maxRequests) {
			return buildStateResponse({
				ok: false,
				error: "Too many build requests. Try again later.",
				retry_after_ms: Math.max(0, windowMs - (now - bucket.window_started_at)),
			}, { status: 429 });
		}

		bucket.count += 1;
		await this.state.storage.put("bucket", bucket);

		return buildStateResponse({
			ok: true,
			remaining: Math.max(0, maxRequests - bucket.count),
		});
	}
}

export default {
	async fetch() {
		return new Response("mews-playlist-jobs", {
			headers: {
				"Content-Type": "text/plain; charset=utf-8",
			},
		});
	},
};
