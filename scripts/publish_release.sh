#!/usr/bin/env bash
# ==============================================================================
# KY-Poni - Automated Release & Distribution Pipeline
# Builds Linux (.AppImage) & Windows (.exe) binaries and publishes to GitHub Releases.
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${PROJECT_ROOT}"

VERSION=$(node -e "console.log(require('./package.json').version)")
TAG="v${VERSION}"
CHANGELOG_FILE="${PROJECT_ROOT}/changelogs/CHANGELOG_v${VERSION}.md"
if [[ ! -f "${CHANGELOG_FILE}" ]]; then
  CHANGELOG_FILE="${PROJECT_ROOT}/CHANGELOG_v${VERSION}.md"
fi

echo "============================================================"
echo "  Publishing KY-Poni ${TAG} to GitHub Releases"
echo "============================================================"

# 1. Ensure tests pass
echo "🧪 Running automated tests..."
npm test

# 2. Build binaries
echo "📦 Building Linux AppImage..."
npm run build:linux

echo "📦 Building Windows Portable Executable..."
npm run build:win

APPIMAGE_PATH="${PROJECT_ROOT}/dist/KY-Poni-${VERSION}.AppImage"
WIN_EXE_PATH="${PROJECT_ROOT}/dist/KY-Poni ${VERSION}.exe"

if [[ ! -f "${APPIMAGE_PATH}" ]]; then
  echo "❌ Error: AppImage not found at ${APPIMAGE_PATH}" >&2
  exit 1
fi

if [[ ! -f "${WIN_EXE_PATH}" ]]; then
  echo "❌ Error: Windows exe not found at ${WIN_EXE_PATH}" >&2
  exit 1
fi

# 3. Create or Update GitHub Release
echo "🚀 Uploading binaries to GitHub Releases (${TAG})..."

# If tag already exists on remote, delete it to allow re-releasing
if gh release view "${TAG}" >/dev/null 2>&1; then
  echo "⚠️ Release ${TAG} exists, updating release assets..."
  gh release upload "${TAG}" "${APPIMAGE_PATH}" "${WIN_EXE_PATH}" --clobber
else
  if [[ -f "${CHANGELOG_FILE}" ]]; then
    gh release create "${TAG}" "${APPIMAGE_PATH}" "${WIN_EXE_PATH}" \
      --title "KY-Poni ${TAG}" \
      --notes-file "${CHANGELOG_FILE}"
  else
    gh release create "${TAG}" "${APPIMAGE_PATH}" "${WIN_EXE_PATH}" \
      --title "KY-Poni ${TAG}" \
      --notes "Release ${TAG} of KY-Poni."
  fi
fi

echo "✅ Release successfully published: https://github.com/Milkyponi/KY-Poni/releases/tag/${TAG}"

# 4. Notify Discord Channels
DISCORD_SCRIPT="/home/milkyponi/.hermes/scripts/discord_webhook.py"
if [[ -f "${DISCORD_SCRIPT}" ]]; then
  echo "📢 Sending release notifications to Discord Milky Brain HQ..."
  python3 "${DISCORD_SCRIPT}" project-archive "🚀 **KY-Poni ${TAG} Berhasil Dirilis ke Publik!**\n\nDownload:\n• Linux: https://github.com/Milkyponi/KY-Poni/releases/download/${TAG}/KY-Poni-${VERSION}.AppImage\n• Windows: https://github.com/Milkyponi/KY-Poni/releases/download/${TAG}/KY-Poni%20${VERSION}.exe\n\nRepository: https://github.com/Milkyponi/KY-Poni" || true
fi

echo "🎉 All release tasks completed!"
