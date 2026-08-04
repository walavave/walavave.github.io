import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { APIRoute } from 'astro';
import { getContentRoot, listContentAssetEntries } from '../../lib/content-local-images.mjs';

const MIME_BY_EXTENSION = {
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp'
};

// Dev needs to serve newly added/edited content attachments without requiring
// a Vite restart. Production still emits the known asset paths statically.
export const prerender = import.meta.env.PROD;

export async function getStaticPaths() {
  return listContentAssetEntries().map((entry) => ({
    params: {
      path: entry.relativePath
    },
    props: {
      absolutePath: entry.absolutePath
    }
  }));
}

export const GET: APIRoute = async ({ params, props }) => {
  let absolutePath = typeof props?.absolutePath === 'string' && props.absolutePath
    ? props.absolutePath
    : '';
  if (!absolutePath && params.path) {
    const root = path.resolve(getContentRoot());
    const candidate = path.resolve(root, params.path);
    if (candidate === root || !candidate.startsWith(`${root}${path.sep}`)) {
      return new Response('Not Found', { status: 404 });
    }
    absolutePath = candidate;
  }
  if (!absolutePath) {
    return new Response('Not Found', { status: 404 });
  }

  const body = await readFile(absolutePath);
  const contentType = MIME_BY_EXTENSION[path.extname(absolutePath).toLowerCase() as keyof typeof MIME_BY_EXTENSION]
    ?? 'application/octet-stream';

  return new Response(body, {
    headers: {
      'content-type': contentType,
      'cache-control': 'public, max-age=31536000, immutable'
    }
  });
};
