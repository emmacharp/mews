#!/usr/bin/env node

import { writeFile } from "node:fs/promises";
import process from "node:process";
import { extractSpotifyPlaylist } from "../lib/extract_spotify_playlist.mjs";

const usage = () => {
	console.error("Usage: node showcase/extract_spotify_playlist_playwright.mjs <playlist-url> [output-xml]");
	process.exit(1);
};

if (process.argv.length < 3 || process.argv.length > 4) {
	usage();
}

const xmlEscape = (value) =>
	String(value)
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&apos;");

const toXml = (playlist) => {
	const lines = [
		"<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
		"<plist version=\"1.0\">",
		"<dict>",
		"\t<key>Major Version</key><integer>1</integer>",
		"\t<key>Minor Version</key><integer>1</integer>",
		"\t<key>Application Version</key><string>Spotify Playwright Import</string>",
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
		if (track.year && /^\d{4}$/.test(track.year)) {
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

const playlistUrl = process.argv[2];
const outputPath = process.argv[3] || "showcase/spotify-playlist.xml";
const playlist = await extractSpotifyPlaylist(playlistUrl);

await writeFile(outputPath, toXml(playlist), "utf8");
console.log(`Wrote ${outputPath} (${playlist.tracks.length} tracks)`);
