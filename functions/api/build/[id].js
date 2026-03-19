import { json, handleOptions, withCors } from "../../../src/lib/http.mjs";

export async function onRequestOptions() {
	return handleOptions();
}

export async function onRequestGet({ params, env }) {
	const playlistId = String(params?.id || "").trim();
	if (!playlistId) {
		return withCors(json({ ok: false, error: "Playlist id is required." }, 400));
	}

	const jobId = env.PLAYLIST_JOBS.idFromName(playlistId);
	const job = env.PLAYLIST_JOBS.get(jobId);
	const response = await job.fetch("https://playlist-job/status");
	const payload = await response.json();

	return withCors(json(payload, response.status));
}
