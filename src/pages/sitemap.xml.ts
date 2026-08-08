import type { APIRoute } from 'astro';
import { site } from '../../site.config.mjs';

const escapeXml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&apos;');

export const GET: APIRoute = () => {
  const origin = new URL(site.url);
  const sitePath = origin.pathname.replace(/\/+$/, '');
  const basePath = (import.meta.env.BASE_URL ?? '/').replace(/\/+$/, '');
  const deploymentPath = sitePath.endsWith(basePath) ? sitePath : `${sitePath}${basePath}`;
  origin.pathname = `${deploymentPath}/sitemap-0.xml`.replace(/\/+/g, '/');
  origin.search = '';
  origin.hash = '';
  const sitemapUrl = escapeXml(origin.toString());
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>${sitemapUrl}</loc></sitemap></sitemapindex>`;

  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' }
  });
};
