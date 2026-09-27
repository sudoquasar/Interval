#!/bin/sh
# Copies the published `data` branch into public/data (or the directory given) for local
# development and for the deploy build. Pipeline state is left out: browsers never need it.
set -eu

DEST="${1:-public/data}"

git fetch --depth=1 --quiet origin data
rm -rf "$DEST"
mkdir -p "$DEST"
git archive FETCH_HEAD | tar -x -C "$DEST"
rm -rf "$DEST/state"

echo "Pulled the data branch into $DEST"
