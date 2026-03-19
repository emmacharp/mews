const SPOTIFY_PLAYLIST_ID_PATTERN = /^[A-Za-z0-9]{10,}$/;

export const extractSpotifyPlaylistId = (value) => {
	const input = String(value || "").trim();
	if (!input) return "";

	if (SPOTIFY_PLAYLIST_ID_PATTERN.test(input)) {
		return input;
	}

	const spotifyUriMatch = input.match(/^spotify:playlist:([A-Za-z0-9]+)$/);
	if (spotifyUriMatch) {
		return spotifyUriMatch[1];
	}

	try {
		const url = new URL(input);
		if (url.hostname !== "open.spotify.com") {
			return "";
		}

		const parts = url.pathname.split("/").filter(Boolean);
		if (parts.length >= 2 && parts[0] === "playlist" && SPOTIFY_PLAYLIST_ID_PATTERN.test(parts[1])) {
			return parts[1];
		}
	} catch {
		return "";
	}

	return "";
};

export const toSpotifyPlaylistUrl = (playlistId) => `https://open.spotify.com/playlist/${playlistId}`;

export const normalizeSpotifyPlaylistInput = (value) => {
	const playlistId = extractSpotifyPlaylistId(value);
	if (!playlistId) {
		return null;
	}

	return {
		playlistId,
		playlistUrl: toSpotifyPlaylistUrl(playlistId),
	};
};
