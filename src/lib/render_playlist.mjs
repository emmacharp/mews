const HTML_DOCTYPE = "<!DOCTYPE html>";

const escapeHtml = (value) =>
	String(value ?? "")
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;");

const SPECIAL_CHARACTERS = "/ áàâäéèêëíìîïóòôöúùûüçÁÀÂÄÉÈÊËÍÌÎÏÓÒÔÖÚÙÛÜÇABCDEFGHIJKLMNOPQRSTUVWXYZ&'’?.()!:,[\\]";
const NORMALIZED_SPECIAL_CHARACTERS = "--aaaaeeeeiiiioooouuuuçaaaaeeeeiiiioooouuuuçabcdefghijklmnopqrstuvwxyz_";

const normalizeString = (value) => {
	const normalized = String(value ?? "").trim().replace(/\s+/g, " ");
	let output = "";

	for (const character of normalized) {
		const index = SPECIAL_CHARACTERS.indexOf(character);
		output += index >= 0 ? NORMALIZED_SPECIAL_CHARACTERS[index] : character.toLowerCase();
	}

	return output;
};

const byTextAsc = (left, right) =>
	String(left ?? "").localeCompare(String(right ?? ""), "en", { sensitivity: "base" });

const byYearAsc = (left, right) => {
	const leftYear = Number.parseInt(left?.year || "0", 10) || 0;
	const rightYear = Number.parseInt(right?.year || "0", 10) || 0;
	if (leftYear !== rightYear) {
		return leftYear - rightYear;
	}

	return byTextAsc(left?.album, right?.album);
};

const toCoverPath = (track) => {
	const location = track?.location || "";
	const coverUrl = track?.cover_url || "";

	if (/^https?:\/\//.test(location)) {
		return location;
	}

	if (coverUrl) {
		return coverUrl;
	}

	return `/assets/covers/${location}/cover.webp`;
};

const groupByArtist = (tracks) => {
	const byArtist = new Map();

	for (const track of tracks) {
		const artist = track.artist || "";
		if (!byArtist.has(artist)) {
			byArtist.set(artist, []);
		}

		byArtist.get(artist).push(track);
	}

	return Array.from(byArtist.entries())
		.map(([artist, artistTracks]) => ({ artist, tracks: artistTracks }))
		.sort((left, right) => byTextAsc(left.artist, right.artist));
};

const groupAlbums = (artistTracks) => {
	const byAlbum = new Map();

	for (const track of artistTracks) {
		const album = track.album || "";
		if (!byAlbum.has(album)) {
			byAlbum.set(album, []);
		}

		byAlbum.get(album).push(track);
	}

	return Array.from(byAlbum.entries())
		.map(([album, tracks]) => ({
			album,
			tracks,
			representative: tracks[0] || {},
		}))
		.sort((left, right) => byYearAsc(left.representative, right.representative));
};

const buildQuery = (track) =>
	[
		normalizeString(track.name),
		normalizeString(track.artist),
		normalizeString(track.album),
	]
		.filter(Boolean)
		.join("+");

const renderPlayerMenu = (track) => {
	const spotifyHref = track.spotify_track_url || track.spotify_album_url || `https://duckduckgo.com/?q=!ducky+${buildQuery(track)}`;
	const query = buildQuery(track);

	return `<menu>
<li><a href="${escapeHtml(spotifyHref)}">
						Spotify
					</a></li>
<li><a href="https://duckduckgo.com/?q=%5Capple+music+${escapeHtml(query)}">Apple Music</a></li>
<li>
<a href="https://duckduckgo.com/?q=%5Cyoutube+${escapeHtml(query)}"></a>Youtube</li>
<li><a href="https://duckduckgo.com/?q=%5Cbandcamp+${escapeHtml(query)}">Bandcamp</a></li>
</menu>`;
};

const renderInfoRow = (label, value, track) => `<dt data-label="${escapeHtml(label)}"><small>${escapeHtml(label === "Name" ? "Song" : label)}</small></dt>
<dd>
${renderPlayerMenu(track)}
<span>${escapeHtml(value || "n/a")}</span>
</dd>`;

const renderYearRow = (year) => `<dt data-label="Year"><small>Year</small></dt>
<dd><span>${escapeHtml(year || "n/a")}</span></dd>`;

const renderRatingRow = () => `<dt data-label="Rating"><small>Rating</small></dt>
<dd><span class="as-star-rating" aria-label="4 stars out of 5" style="--rating: 80%"><span class="__base" aria-hidden="true">☆☆☆☆☆</span><span class="__fill" aria-hidden="true">★★★★★</span></span></dd>`;

const renderSong = (track) => {
	const songId = `${normalizeString(track.album)}-${normalizeString(track.name)}`;

	return `<article data-type="song" id="${escapeHtml(songId)}"><dl data-type="metadata">
${renderInfoRow("Name", track.name, track)}
${renderRatingRow()}
</dl></article>`;
};

const renderAlbum = (albumGroup) => {
	const representative = albumGroup.representative || {};
	const coverPath = toCoverPath(representative);
	const songsNav = albumGroup.tracks
		.map((track) => {
			const songId = `${normalizeString(track.album)}-${normalizeString(track.name)}`;
			return `<a href="#${escapeHtml(songId)}">■</a>`;
		})
		.join("");

	const genre = representative.genre || "n/a";
	const year = representative.year || "n/a";
	const songs = albumGroup.tracks.map(renderSong).join("");

	return `<article data-type="album" style="--placeholder: url('${escapeHtml(coverPath)}')"><div>
<header><img alt="${escapeHtml(representative.location || "")}" loading="lazy" src="${escapeHtml(coverPath)}"><h4>${escapeHtml(albumGroup.album)}</h4>
<nav data-type="songs">${songsNav}</nav></header><dl data-type="metadata">
${renderInfoRow("Artist", representative.artist, representative)}
${renderInfoRow("Album", albumGroup.album, representative)}
${renderInfoRow("Genre", genre, representative)}
${renderYearRow(year)}
</dl>
${songs}
</div></article>`;
};

const renderArtist = (artistGroup, artistIndex) => {
	const artistSlug = normalizeString(artistGroup.artist);
	const albums = groupAlbums(artistGroup.tracks).map(renderAlbum).join("");

	return `<article data-type="artist" id="artist-${artistIndex}" data-artist-index="${artistIndex}" data-artist-slug="${escapeHtml(artistSlug)}"><h3>${escapeHtml(artistGroup.artist)}</h3>
${albums}</article>`;
};

const renderArtistSections = (artists, startIndex, artistsPerSection, includeAllSections) => {
	const sections = [];

	for (let index = 0; index < artists.length; index += artistsPerSection) {
		const sectionIndex = Math.floor(index / artistsPerSection) + 1;
		if (!includeAllSections && index >= startIndex) {
			break;
		}

		const sectionArtists = artists.slice(index, index + artistsPerSection);
		sections.push(`<section data-type="artist-section" id="artist-section-${sectionIndex}" data-section-index="${sectionIndex}">${sectionArtists
			.map((artistGroup, offset) => renderArtist(artistGroup, index + offset + 1))
			.join("")}</section>`);
	}

	return sections.join("");
};

const renderFullPage = ({ artists, maxArtists, artistsPerSection, enableInfiniteLoading }) => {
	const totalArtists = artists.length;
	const initialEnd = Math.min(totalArtists, maxArtists);
	const totalSections = Math.floor((totalArtists + artistsPerSection - 1) / artistsPerSection);
	const initialSectionEnd = Math.floor((initialEnd + artistsPerSection - 1) / artistsPerSection);
	const artistSections = renderArtistSections(artists, initialEnd, artistsPerSection, false);

	return `${HTML_DOCTYPE}
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Songlist</title>
<link rel="stylesheet" href="/assets/css/quarantine.css">
${enableInfiniteLoading ? '<script src="https://unpkg.com/htmx.org@2.0.4" defer></script>' : ""}<script src="/assets/js/music.js" defer></script>
</head>
<body>
<main class="album-mosaic" id="artist-stream" data-artists-source="artists.html" data-batch-size="${maxArtists}" data-total-artists="${totalArtists}" data-total-sections="${totalSections}" data-start-index="1" data-end-index="${initialEnd}" data-next-section-index="${initialSectionEnd + 1}" data-infinite-loading="${enableInfiniteLoading ? 1 : 0}">${artistSections}</main>
${enableInfiniteLoading ? '<div id="artist-load-more" aria-hidden="true"></div>' : ""}
</body>
</html>`;
};

const renderArtistsOnly = ({ artists, artistsPerSection }) =>
	`${HTML_DOCTYPE}
${renderArtistSections(artists, Number.POSITIVE_INFINITY, artistsPerSection, true)}`;

export const renderPlaylistPages = async (playlist) => {
	const artists = groupByArtist(playlist.tracks || []);

	return {
		indexHtml: renderFullPage({
			artists,
			maxArtists: 24,
			artistsPerSection: 12,
			enableInfiniteLoading: true,
		}),
		artistsHtml: renderArtistsOnly({
			artists,
			artistsPerSection: 12,
		}),
	};
};
