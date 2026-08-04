#!/usr/bin/env bash
# SensBoxd - Local dev server launcher
# Usage: ./dev.sh [port]
#
# Launches a PHP dev server on the given port (default 9000) with all
# system HTTP/SOCKS proxy env vars unset. The Cursor IDE terminal exports
# these variables (e.g. HTTP_PROXY=http://127.0.0.1:59745) which cURL
# inside proxy.php inherits, causing "CONNECT tunnel failed, 403" errors
# when trying to reach apollo.senscritique.com.

set -e

PORT="${1:-9000}"
ROOT="$(cd "$(dirname "$0")" && pwd)"

if ! command -v php >/dev/null 2>&1; then
    echo "❌ PHP is not installed."
    echo "   macOS:  brew install php"
    echo "   Debian: sudo apt install php-cli php-curl"
    exit 1
fi

echo "🚀 Starting SensBoxd dev server on http://localhost:${PORT}/"
echo "   (proxy env vars cleared to avoid Cursor terminal issues)"
echo ""

exec env \
    -u HTTP_PROXY -u HTTPS_PROXY -u http_proxy -u https_proxy \
    -u ALL_PROXY -u all_proxy \
    -u SOCKS_PROXY -u SOCKS5_PROXY -u socks_proxy -u socks5_proxy \
    -u GIT_HTTP_PROXY -u GIT_HTTPS_PROXY \
    php -S "localhost:${PORT}" -t "${ROOT}"
