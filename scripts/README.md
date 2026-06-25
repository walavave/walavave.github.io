# Scripts

## `organize-paper-images.mjs`

Moves local images referenced by a paper markdown file into `public/papers/<markdown-file-name>/`,
renames them sequentially like `1.png`, `2.png`, and rewrites the markdown image paths.

Usage:

```bash
npm run organize-paper-images -- 1.md
```

The script only looks inside `src/content/docs/papers/`, so pass just the file name like `1.md` or `1.mdx`.
