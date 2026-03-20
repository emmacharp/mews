import { chromium } from "playwright";

const absoluteSpotifyUrl = (value) => {
	if (!value) return "";
	if (value.startsWith("http://") || value.startsWith("https://")) return value;
	if (value.startsWith("/")) return `https://open.spotify.com${value}`;
	return value;
};

const toLargeSpotifyCover = (value) => {
	if (!value) return "";
	return value
		.replace("ab67616d00004851", "ab67616d0000b273")
		.replace("ab67616d00001e02", "ab67616d0000b273");
};

const collectSnapshot = async (page) =>
	page.evaluate(() => {
		const text = (node) => node?.textContent?.trim() || "";
		const meta = (selector) => document.querySelector(selector)?.getAttribute("content") || "";
		const playlistUrlFromMeta = meta('meta[property="og:url"]') || location.href;
		const playlistName = meta('meta[property="og:title"]') || document.title.replace(/\s*-\s*playlist.*$/i, "").trim();
		const playlistIdMatch = playlistUrlFromMeta.match(/\/playlist\/([A-Za-z0-9]+)/);
		const expectedCountMatch = (meta('meta[property="og:description"]') || meta('meta[name="description"]') || "").match(/(\d+)\s+items?/i);
		const expectedCount = expectedCountMatch ? Number.parseInt(expectedCountMatch[1], 10) : 0;
		const rows = Array.from(document.querySelectorAll('[data-testid="tracklist-row"]'));
		const tracks = rows.map((row) => {
			const trackCell = row.querySelector('[aria-colindex="2"]') || row;
			const albumCell = row.querySelector('[aria-colindex="3"]') || row;
			const dateCell = row.querySelector('[aria-colindex="5"]') || null;
			const trackLink = trackCell.querySelector('a[data-testid="internal-track-link"], a[href^="/track/"]');
			const artistLinks = Array.from(trackCell.querySelectorAll('a[href^="/artist/"]'));
			const albumLink = albumCell.querySelector('a[href^="/album/"]');
			const cover = row.querySelector('img[src*="scdn.co"], img[src*="spotifycdn"]');
			const addedOrYear = text(dateCell);
			const yearMatch = addedOrYear.match(/\b(19|20)\d{2}\b/);

			return {
				name: text(trackLink),
				artist: artistLinks.map((link) => text(link)).filter(Boolean).join(", "),
				album: text(albumLink),
				year: yearMatch ? yearMatch[0] : "",
				location: cover?.getAttribute("src") || "",
				cover_url: cover?.getAttribute("src") || "",
				spotify_track_url: trackLink?.getAttribute("href") || "",
				spotify_album_url: albumLink?.getAttribute("href") || "",
				spotify_artist_url: artistLinks[0]?.getAttribute("href") || "",
			};
		}).filter((track) => track.name && track.spotify_track_url);

		return {
			id: playlistIdMatch?.[1] || "",
			name: playlistName,
			url: playlistUrlFromMeta,
			expectedCount,
			tracks,
		};
	});

const mergeTracks = (existing, incoming) => {
	for (const track of incoming) {
		const key = absoluteSpotifyUrl(track.spotify_track_url) || `${track.artist}|${track.album}|${track.name}`;
		if (!key || existing.has(key)) {
			continue;
		}

		existing.set(key, {
			...track,
			location: toLargeSpotifyCover(track.location || ""),
			cover_url: toLargeSpotifyCover(track.cover_url || track.location || ""),
			spotify_track_url: absoluteSpotifyUrl(track.spotify_track_url),
			spotify_album_url: absoluteSpotifyUrl(track.spotify_album_url),
			spotify_artist_url: absoluteSpotifyUrl(track.spotify_artist_url),
		});
	}
};

const advanceTracklist = async (page) =>
	page.evaluate(() => {
		const row = document.querySelector('[data-testid="tracklist-row"]');
		const findScrollableAncestor = (node) => {
			let current = node;
			while (current && current !== document.body) {
				if (!(current instanceof HTMLElement)) {
					current = current.parentElement;
					continue;
				}
				const style = window.getComputedStyle(current);
				const overflowY = style.overflowY;
				if ((overflowY === "auto" || overflowY === "scroll") && current.scrollHeight > current.clientHeight + 20) {
					return current;
				}
				current = current.parentElement;
			}
			return document.scrollingElement || document.documentElement;
		};

		const scroller = findScrollableAncestor(row || document.body);
		const previousTop = scroller.scrollTop;
		const increment = Math.max(Math.floor(scroller.clientHeight * 0.9), 600);
		scroller.scrollTop = Math.min(scroller.scrollTop + increment, scroller.scrollHeight);

		if (scroller.scrollTop === previousTop) {
			const rows = Array.from(document.querySelectorAll('[data-testid="tracklist-row"]'));
			rows.at(-1)?.scrollIntoView({ block: "end" });
		}
	});

export const extractSpotifyPlaylist = async (playlistUrl) => {
	const browser = await chromium.launch({
		headless: true,
	});
	const page = await browser.newPage();

	try {
		await page.goto(playlistUrl, {
			waitUntil: "domcontentloaded",
			timeout: 45000,
		});

		await page.waitForSelector('meta[property="og:description"], [data-testid="tracklist-row"], [data-testid="tracklist-row-placeholder"]', {
			state: "attached",
			timeout: 15000,
		});
		await page.waitForTimeout(1500);

		const trackMap = new Map();
		let playlistMeta = {
			id: "",
			name: "",
			url: playlistUrl,
			expectedCount: 0,
		};
		let stagnantPasses = 0;
		let previousCount = 0;

		for (let attempt = 0; attempt < 80; attempt += 1) {
			const snapshot = await collectSnapshot(page);
			playlistMeta = {
				...playlistMeta,
				id: snapshot.id || playlistMeta.id,
				name: snapshot.name || playlistMeta.name,
				url: snapshot.url || playlistMeta.url,
				expectedCount: snapshot.expectedCount || playlistMeta.expectedCount,
			};
			mergeTracks(trackMap, snapshot.tracks);

			if (trackMap.size === previousCount) {
				stagnantPasses += 1;
			} else {
				stagnantPasses = 0;
				previousCount = trackMap.size;
			}

			if (playlistMeta.expectedCount && trackMap.size >= playlistMeta.expectedCount) {
				break;
			}

			if (stagnantPasses >= 5) {
				break;
			}

			if (!playlistMeta.expectedCount && stagnantPasses >= 2) {
				break;
			}

			await advanceTracklist(page);
			await page.waitForTimeout(600);
		}

		return {
			id: playlistMeta.id,
			name: playlistMeta.name,
			url: playlistMeta.url,
			tracks: Array.from(trackMap.values()),
		};
	} finally {
		await browser.close();
	}
};
