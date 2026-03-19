import SaxonJS from "saxonjs-he";
import musicSefText from "../templates/music_sef.mjs";

const parseXml = (xmlString) => SaxonJS.internals.getPlatform().parseXmlFromString(xmlString, true);

const render = async (xmlString, params) => {
	const sourceNode = parseXml(xmlString);
	const result = await SaxonJS.transform({
		stylesheetText: musicSefText,
		sourceNode,
		destination: "serialized",
		stylesheetParams: params,
	}, "async");

	return result.principalResult;
};

export const renderPlaylistPages = async (xmlString) => {
	const [indexHtml, artistsHtml] = await Promise.all([
		render(xmlString, {
			artist_offset: 0,
			max_artists: 24,
			enable_infinite_loading: 1,
		}),
		render(xmlString, {
			artist_offset: 0,
			max_artists: 999999,
			enable_infinite_loading: 0,
		}),
	]);

	return {
		indexHtml,
		artistsHtml,
	};
};
