import type { APIRoute } from 'astro';
import { hasSiteUrl, siteUrl } from '../../site.config.mjs';

export const GET: APIRoute = () => {
  const lines = ['User-agent: *', 'Allow: /'];

  if (hasSiteUrl) {
    const basePath = import.meta.env.BASE_URL.replace(/\/+$/, '');
    const site = new URL(siteUrl);
    const sitePath = site.pathname.replace(/\/+$/, '');
    // GitHub Pages 的项目站点会同时把项目路径写入 SITE_URL 和 BASE_URL，
    // 这里避免生成 /blog/blog/sitemap-index.xml。
    const sitemapPath = sitePath.endsWith(basePath)
      ? `${sitePath}/sitemap-index.xml`
      : `${sitePath}${basePath}/sitemap-index.xml`;
    site.pathname = sitemapPath;
    site.search = '';
    site.hash = '';
    lines.push(`Sitemap: ${site.toString()}`);
  }

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8'
    }
  });
};
