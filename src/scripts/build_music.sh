#!/bin/zsh

set -euo pipefail

script_dir=${0:A:h}
input_xml=${1:?Usage: $0 <input-xml> [template-xsl]}
template_xsl=${2:-"$script_dir/../templates/music.xsl"}
batch_size=${BATCH_SIZE:-24}
playlist_root=${PLAYLIST_ROOT:-"$script_dir/../../playlists"}
input_name=${${input_xml:t}%.*}
output_dir="$playlist_root/$input_name"
index_output="$output_dir/index.html"
artists_output="$output_dir/artists.html"

if [[ ! -f "$input_xml" ]]; then
	echo "Input XML not found: $input_xml" >&2
	exit 1
fi

mkdir -p "$output_dir"

xsltproc \
	--stringparam artist_offset 0 \
	--stringparam max_artists "$batch_size" \
	--stringparam enable_infinite_loading 1 \
	-o "$index_output" \
	"$template_xsl" \
	"$input_xml"

xsltproc \
	--stringparam artist_offset 0 \
	--stringparam max_artists 999999 \
	--stringparam enable_infinite_loading 0 \
	-o "$artists_output" \
	"$template_xsl" \
	"$input_xml"
