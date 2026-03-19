const xmlEscape = (value) =>
	String(value)
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&apos;");

export const playlistToXml = (playlist) => {
	const lines = [
		"<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
		"<plist version=\"1.0\">",
		"<dict>",
		"\t<key>Major Version</key><integer>1</integer>",
		"\t<key>Minor Version</key><integer>1</integer>",
		"\t<key>Application Version</key><string>Spotify Playlist Import</string>",
		"\t<key>Features</key><integer>1</integer>",
		`\t<key>Playlist ID</key><string>${xmlEscape(playlist.id || "")}</string>`,
		`\t<key>Playlist Name</key><string>${xmlEscape(playlist.name || "Spotify Playlist")}</string>`,
		`\t<key>Playlist URL</key><string>${xmlEscape(playlist.url || "")}</string>`,
		"\t<key>Tracks</key>",
		"\t<dict>",
	];

	playlist.tracks.forEach((track, index) => {
		lines.push(`\t\t<key>${index + 1}</key>`);
		lines.push("\t\t<dict>");
		lines.push(`\t\t\t<key>Name</key><string>${xmlEscape(track.name || "")}</string>`);
		lines.push(`\t\t\t<key>Artist</key><string>${xmlEscape(track.artist || "")}</string>`);
		lines.push(`\t\t\t<key>Album</key><string>${xmlEscape(track.album || "")}</string>`);
		if (track.genre) {
			lines.push(`\t\t\t<key>Genre</key><string>${xmlEscape(track.genre)}</string>`);
		}
		if (track.year && /^\d{4}$/.test(String(track.year))) {
			lines.push(`\t\t\t<key>Year</key><integer>${track.year}</integer>`);
		}
		if (track.location) {
			lines.push(`\t\t\t<key>Location</key><string>${xmlEscape(track.location)}</string>`);
		}
		if (track.cover_url) {
			lines.push(`\t\t\t<key>Cover URL</key><string>${xmlEscape(track.cover_url)}</string>`);
		}
		if (track.spotify_track_url) {
			lines.push(`\t\t\t<key>Spotify Track URL</key><string>${xmlEscape(track.spotify_track_url)}</string>`);
		}
		if (track.spotify_album_url) {
			lines.push(`\t\t\t<key>Spotify Album URL</key><string>${xmlEscape(track.spotify_album_url)}</string>`);
		}
		if (track.spotify_artist_url) {
			lines.push(`\t\t\t<key>Spotify Artist URL</key><string>${xmlEscape(track.spotify_artist_url)}</string>`);
		}
		lines.push("\t\t</dict>");
	});

	lines.push("\t</dict>");
	lines.push("</dict>");
	lines.push("</plist>");

	return `${lines.join("\n")}\n`;
};
