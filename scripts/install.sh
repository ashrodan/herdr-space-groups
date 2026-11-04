#!/bin/sh
# Install spaces-groups into Herdr. Optional: --layout NAME puts it in place of
# the `spaces` sidebar in that layout (backed up once to NAME.json.before-spaces-groups).
# --undo --layout NAME puts `spaces` back.
set -eu
HOME_DIR="${HERDR_APP_HOME:-$HOME/.config/herdr-app}"
SRC="$(cd "$(dirname "$0")/.." && pwd)/mods/spaces-groups"
DEST="$HOME_DIR/mods/spaces-groups"
LAYOUT=""; UNDO=0
while [ $# -gt 0 ]; do
  case "$1" in
    --layout) LAYOUT="$2"; shift 2 ;;
    --undo) UNDO=1; shift ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
done

if [ "$UNDO" = 0 ]; then
  mkdir -p "$DEST"
  # groups.json is yours: never overwritten.
  for f in main.js groups.js mod.json groups.example.json; do cp "$SRC/$f" "$DEST/$f"; done
  [ -f "$DEST/groups.json" ] || cp "$SRC/groups.example.json" "$DEST/groups.json"
  herdr-app check "$DEST"
fi

[ -n "$LAYOUT" ] || exit 0
case "$LAYOUT" in main|terminals|win98)
  echo "Herdr replaces its own layout '$LAYOUT' on every start. Clone it first:" >&2
  echo "  herdr-app do layout.clone --name $LAYOUT --as my-$LAYOUT" >&2
  exit 1 ;;
esac
FILE="$HOME_DIR/layouts/$LAYOUT.json"
[ -f "$FILE" ] || { echo "no layout: $FILE" >&2; exit 1; }
if [ "$UNDO" = 1 ]; then FROM=spaces-groups; TO=spaces; else FROM=spaces; TO=spaces-groups; fi
[ -f "$FILE.before-spaces-groups" ] || cp "$FILE" "$FILE.before-spaces-groups"
node -e '
const fs = require("fs"); const [file, from, to] = process.argv.slice(1);
const doc = JSON.parse(fs.readFileSync(file, "utf8")); let n = 0;
(function walk(x) { if (Array.isArray(x)) return x.forEach(walk); if (!x || typeof x !== "object") return;
  if (x.mod === from) { x.mod = to; n++; } Object.values(x).forEach(walk); })(doc);
if (!n) { console.log(`no "${from}" block in ${file}; nothing changed`); process.exit(0); }
fs.writeFileSync(file + ".tmp", JSON.stringify(doc, null, 2) + "\n"); fs.renameSync(file + ".tmp", file);
console.log(`${file}: ${n} block(s) ${from} -> ${to}`);' "$FILE" "$FROM" "$TO"
