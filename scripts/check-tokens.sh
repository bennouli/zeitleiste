#!/usr/bin/env bash
# Fails if pages/components use raw colors or primitive tokens.
# Only src/app/globals.css may define them; everything else uses semantic
# tokens (bg-surface, text-fg, text-russia, …).
set -uo pipefail
cd "$(dirname "$0")/.."

# 1. hex colors (not preceded by a word char or '&', e.g. not `&#123;`;
#    `issue #12` and `href="#anchor"` are allowed)
# 2. color functions
# 3. primitive token names
# 4. Tailwind default-palette / named-color classes (the default palette is
#    disabled in globals.css, so these would silently render nothing)
pattern='(^|[^[:alnum:]_&/])#[0-9a-fA-F]{3}([0-9a-fA-F]{1,5})?\b'
pattern+='|\b(rgba?|hsla?|oklch|oklab|lab|lch|hwb|color-mix)\('
pattern+='|--(paper|ink|focus-blue)\b|--(space|radius)-[0-9]'
pattern+='|\b(bg|text|border|fill|stroke|ring|outline|from|via|to|shadow|decoration|accent|caret|divide|placeholder)-(black|white|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)\b'

for dir in src/app src/components; do
  if [ ! -d "$dir" ]; then
    echo "check:tokens: missing directory $dir" >&2
    exit 2
  fi
done

matches=$(grep -rEn \
  --include='*.ts' --include='*.tsx' --include='*.mts' --include='*.js' \
  --include='*.jsx' --include='*.mjs' --include='*.css' --include='*.mdx' \
  -e "$pattern" src/app src/components \
  | grep -v '^src/app/globals\.css:' \
  | sed -E 's/([Ii]ssues? #[0-9]+|href="#[^"]*")/_/g' \
  | grep -E -e "$pattern")
if [ -n "$matches" ]; then
  echo "check:tokens: raw colors or primitive tokens found (use semantic tokens instead):" >&2
  echo "$matches" >&2
  exit 1
fi
echo "check:tokens: ok"
