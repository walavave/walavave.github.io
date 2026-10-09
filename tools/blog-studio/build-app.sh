#!/usr/bin/env bash
set -Eeuo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STUDIO="$REPO/tools/blog-studio"
BUILD="$REPO/dist-app"
APP_NAME="MyBlog"
APP="$BUILD/$APP_NAME.app"
IDENTIFIER="me.tky.myblog"
ASSET_CATALOG="$STUDIO/Assets.xcassets"

command -v swiftc >/dev/null 2>&1 || {
  echo "swiftc not found. Install Xcode Command Line Tools." >&2
  exit 1
}

command -v xcrun >/dev/null 2>&1 || {
  echo "xcrun not found. Install Xcode Command Line Tools." >&2
  exit 1
}

[ -f "$ASSET_CATALOG/AppIcon.appiconset/Contents.json" ] || {
  echo "App icon asset catalog not found: $ASSET_CATALOG" >&2
  exit 1
}

rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
ASSET_CATALOG_INFO="$(mktemp "${TMPDIR:-/tmp}/myblog-assets.XXXXXX.plist")"
trap 'rm -f "$ASSET_CATALOG_INFO"' EXIT

echo "Compiling $APP_NAME..."
swiftc \
  -O \
  -module-cache-path "$BUILD/module-cache" \
  -o "$APP/Contents/MacOS/$APP_NAME" \
  "$STUDIO/MyBlog.swift" \
  -framework AppKit \
  -framework WebKit

xcrun actool \
  --compile "$APP/Contents/Resources" \
  --platform macosx \
  --minimum-deployment-target 13.0 \
  --app-icon AppIcon \
  --output-partial-info-plist "$ASSET_CATALOG_INFO" \
  "$ASSET_CATALOG"

cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key><string>en</string>
  <key>CFBundleExecutable</key><string>$APP_NAME</string>
  <key>CFBundleIdentifier</key><string>$IDENTIFIER</string>
  <key>CFBundleInfoDictionaryVersion</key><string>6.0</string>
  <key>CFBundleName</key><string>MyBlog</string>
  <key>CFBundleDisplayName</key><string>MyBlog</string>
  <key>CFBundleIconFile</key><string>AppIcon</string>
  <key>CFBundleIconName</key><string>AppIcon</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>1.0.0</string>
  <key>CFBundleVersion</key><string>1</string>
  <key>LSApplicationCategoryType</key><string>public.app-category.developer-tools</string>
  <key>LSMinimumSystemVersion</key><string>13.0</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>NSPrincipalClass</key><string>NSApplication</string>
  <key>NSAppTransportSecurity</key>
  <dict>
    <key>NSAllowsLocalNetworking</key><true/>
  </dict>
  <key>RepoPath</key><string>$REPO</string>
</dict>
</plist>
PLIST

cp "$STUDIO/start-dev.sh" "$APP/Contents/Resources/"
cp "$STUDIO/sync-blog.sh" "$APP/Contents/Resources/"
chmod +x "$APP/Contents/Resources/start-dev.sh"
chmod +x "$APP/Contents/Resources/sync-blog.sh"

codesign --force --sign - "$APP"

echo "Built: $APP"
echo "Open it with: open \"$APP\""
