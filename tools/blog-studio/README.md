# MyBlog

A small local macOS app for this repository. It starts Astro, embeds `/admin/`, and keeps content changes in sync.

## Build

```bash
tools/blog-studio/build-app.sh
```

The app is created at `dist-app/MyBlog.app`.
Its macOS app icon is compiled from `tools/blog-studio/Assets.xcassets/AppIcon.appiconset`.

## Install

```bash
ditto "dist-app/MyBlog.app" "$HOME/Applications/MyBlog.app"
```

Then open it from Launchpad, Spotlight, or `~/Applications`. Spotlight indexing must be enabled for the startup disk for Command-Space search to work.

## Included behavior

- Starts `astro dev` on `127.0.0.1:4321`.
- Opens `/admin/` inside a native window.
- Uses the repository configured at build time.
- Shows a local process log at the bottom of the window.
- Menu: Sync Now, Push to GitHub, Reload, Go to Admin, Open in Browser, Restart Local Server.
- Runs a daily content sync while the app is open after 23:30.

## Sync behavior

The sync action only stages and commits these paths:

- `src/content`
- `public`
- `site.config.mjs`

Markdown entries whose frontmatter contains `draft: true` are excluded from staging and commits. Matching `*-assets` directories are excluded as well. Sync does not push to GitHub; use Push to GitHub when you are ready to publish local commits.

Commit messages use the current date, for example `content: local studio sync 2026-10-09`.

Run a sync manually with:

```bash
BLOG_STUDIO_REPO="$PWD" BLOG_SYNC_BRANCH=main tools/blog-studio/sync-blog.sh sync

# Fetch remote changes and push local commits.
BLOG_STUDIO_REPO="$PWD" BLOG_SYNC_BRANCH=main tools/blog-studio/sync-blog.sh push
```
