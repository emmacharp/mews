import { json, handleOptions, withCors } from "../../src/lib/http.mjs";
import { normalizeSpotifyPlaylistInput } from "../../src/lib/spotify.mjs";

const RATE_LIMIT = {
	maxRequests: 5,
	windowMs: 10 * 60 * 1000,
};

const getClientIp = (request) =>
	request.headers.get("cf-connecting-ip") ||
	request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
	"unknown";

export async function onRequestOptions() {
	return handleOptions();
}

export async function onRequestPost({ request, env }) {
	let body;
	try {
		body = await request.json();
	} catch {
		return withCors(json({ ok: false, error: "Invalid JSON body." }, 400));
	}

	const normalized = normalizeSpotifyPlaylistInput(body?.playlist_url);
	if (!normalized) {
		return withCors(json({ ok: false, error: "A valid Spotify playlist URL is required." }, 400));
	}

	const clientIp = getClientIp(request);
	const rateLimitId = env.RATE_LIMITS.idFromName(clientIp);
	const rateLimit = env.RATE_LIMITS.get(rateLimitId);
	const rateLimitResponse = await rateLimit.fetch("https://rate-limit/consume", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify(RATE_LIMIT),
	});

	if (!rateLimitResponse.ok) {
		const payload = await rateLimitResponse.json();
		return withCors(json({
			ok: false,
			error: payload.error || "Rate limit exceeded.",
			retry_after_ms: payload.retry_after_ms || RATE_LIMIT.windowMs,
		}, 429));
	}

	const playlistId = normalized.playlistId;
	const jobId = env.PLAYLIST_JOBS.idFromName(playlistId);
	const job = env.PLAYLIST_JOBS.get(jobId);
	const buildResponse = await job.fetch("https://playlist-job/build", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			playlist_id: playlistId,
			playlist_url: normalized.playlistUrl,
			requested_by: clientIp,
		}),
	});
	const payload = await buildResponse.json();

	return withCors(json({
		...payload,
		status_url: `/api/build/${playlistId}`,
		playlist_url: `/playlists/${playlistId}/`,
	}, buildResponse.status));
}
