import type { APIRoute } from 'astro';
import { site } from '../../site.config.mjs';
import { getArchiveEssays, getEssaySlug, getVisibleEssays } from '../lib/content';

const escapeXml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

export const GET: APIRoute = async () => {
  const origin = new URL(site.url);
  const sitePath = origin.pathname.replace(/\/+$/, '');
  const basePath = (import.meta.env.BASE_URL ?? '/').replace(/\/+$/, '');
  const deploymentPath = sitePath.endsWith(basePath) ? sitePath : `${sitePath}${basePath}`;
  const publicUrl = (pathname: string) => {
    const url = new URL(origin);
    url.pathname = `${deploymentPath}${pathname}`.replace(/\/+/g, '/');
    url.search = '';
    url.hash = '';
    return escapeXml(url.toString());
  };
  const urls = new Set(['/','/about/','/archive/','/essay/','/bits/','/memo/']);
  const essays = await getVisibleEssays();
  const archiveEssays = await getArchiveEssays();
  for (const entry of essays) urls.add(`/archive/${getEssaySlug(entry)}/`);
  for (const entry of archiveEssays) urls.add(`/archive/${getEssaySlug(entry)}/`);
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${Array.from(urls, (pathname) => `<url><loc>${publicUrl(pathname)}</loc></url>`).join('')}</urlset>`;

  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' }
  });
};
