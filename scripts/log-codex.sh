#!/usr/bin/env bash
set -euo pipefail

# Simple Codex session logger
# Usage:
#   echo "- 変更点などを箇条書きで" | scripts/log-codex.sh "タイトル"
#   scripts/log-codex.sh "タイトル" "- 箇条書き1" "- 箇条書き2"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOCS_DIR="$ROOT_DIR/docs"
mkdir -p "$DOCS_DIR"

DATE="$(date +%Y-%m-%d)"
TIME="$(date +%H:%M)"
FILE="$DOCS_DIR/codex-session-$DATE.md"
TITLE="${1:-Update}"

shift || true

if [[ ! -f "$FILE" ]]; then
  {
    echo "# Codex セッションログ ($DATE)"
    echo
    echo "- プロジェクト: \`bassoonkeyapp\`"
    echo
  } > "$FILE"
fi

{
  echo "## $DATE $TIME — $TITLE"
  echo
  if [ -p /dev/stdin ]; then
    cat
  else
    if [ "$#" -gt 0 ]; then
      printf "%s\n" "$@"
    else
      echo "- (no details)"
    fi
  fi
  echo
  # 変更ファイル一覧（Gitリポジトリの場合のみ）
  if git -C "$ROOT_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    _status="$(git -C "$ROOT_DIR" status --porcelain || true)"
    if [ -n "$_status" ]; then
      echo "### 変更ファイル"
      while IFS= read -r _line; do
        [ -z "$_line" ] && continue
        _st="${_line:0:2}"
        _path="${_line:3}"
        echo "- ${_st} ${_path}"
      done <<< "$_status"
      echo
    fi
  fi
  echo
} >> "$FILE"
