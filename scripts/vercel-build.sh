#!/usr/bin/env bash
set -euo pipefail

FLUTTER_VERSION=3.50.0
FLUTTER_DIR="/tmp/news-app-flutter-${FLUTTER_VERSION}"
if [ ! -x "$FLUTTER_DIR/bin/flutter" ]; then
  git clone --depth 1 --branch "$FLUTTER_VERSION" https://github.com/flutter/flutter.git "$FLUTTER_DIR"
fi
export PATH="$FLUTTER_DIR/bin:$PATH"
flutter config --no-analytics
node scripts/build-web.cjs
