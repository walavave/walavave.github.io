import type { APIRoute } from 'astro';
import { hasSiteUrl, siteUrl } from '../../site.config.mjs';

export const GET: APIRoute = () => {
  const lines = ['User-agent: *', 'Allow: /'];

  if (hasSiteUrl) {
    lines.push(`Sitemap: ${siteUrl}/sitemap.xml`);
  }

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8'
    }
  });
};
