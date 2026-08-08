import { site } from '../../site.config.mjs';
import { getEssaySlug, getVisibleEssays } from './content';
import { getThemeSettings } from './theme-settings';

const getPublicUrl = (pathname: string) => {
  const origin = new URL(site.url);
  const sitePath = origin.pathname.replace(/\/+$/, '');
  const basePath = (import.meta.env.BASE_URL ?? '/').replace(/\/+$/, '');
  const deploymentPath = sitePath.endsWith(basePath) ? sitePath : `${sitePath}${basePath}`;
  origin.pathname = `${deploymentPath}${pathname}`.replace(/\/+/g, '/');
  return origin.toString();
};

export const buildLlmsTxt = async () => {
  const { settings } = getThemeSettings();
  const essays = await getVisibleEssays();
  const lines = [
    `# ${settings.site.title}`,
    '',
    `> ${settings.site.description}`,
    '',
    '## Site',
    '',
    `- Homepage: ${getPublicUrl('/')}`,
    `- About: ${getPublicUrl('/about/')}`,
    `- Archive: ${getPublicUrl('/archive/')}`,
    '',
    '## Articles',
    ''
  ];

  for (const entry of essays) {
    const description = entry.data.description?.trim();
    lines.push(`- [${entry.data.title}](${getPublicUrl(`/archive/${getEssaySlug(entry)}/`)})${description ? `: ${description}` : ''}`);
  }

  return `${lines.join('\n')}\n`;
};
