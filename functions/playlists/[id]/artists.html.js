const notFound = () =>
	new Response("Not found", {
		status: 404,
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
			"Cache-Control": "public, max-age=60",
		},
	});

export async function onRequestGet({ params, env }) {
	const bucket = env.PLAYLIST_BUCKET;
	const id = String(params?.id || "").trim();

	if (!bucket || !id) {
		return notFound();
	}

	const object = await bucket.get(`playlists/${id}/artists.html`);
	if (!object) {
		return notFound();
	}

	const headers = new Headers(object.httpMetadata || {});
	headers.set("Content-Type", "text/html; charset=utf-8");
	headers.set("Cache-Control", "public, max-age=300");

	return new Response(object.body, { headers });
}
