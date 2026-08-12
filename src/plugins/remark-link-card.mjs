import { visit } from 'unist-util-visit';

const LINK_CARD_SITES = [
  {
    id: 'bilibili',
    hosts: new Set(['bilibili.com', 'www.bilibili.com', 'b23.tv']),
    label: '哔哩哔哩',
    mark: 'B'
  },
  {
    id: 'zhihu',
    hosts: new Set(['zhihu.com', 'www.zhihu.com', 'zhuanlan.zhihu.com']),
    label: '知乎',
    mark: '知'
  }
];

const metadataCache = new Map();
const FETCH_TIMEOUT_MS = 4000;

const text = (value) => ({ type: 'text', value });

const getText = (node) => {
  if (!node) return '';
  if (node.type === 'text') return node.value || '';
  if (Array.isArray(node.children)) return node.children.map(getText).join('');
  return '';
};

const getAttribute = (node, name) => {
  const value = node.attributes?.[name];
  return typeof value === 'string' ? value.trim() : '';
};

const getSite = (url) => LINK_CARD_SITES.find((site) => site.hosts.has(url.hostname.toLowerCase()));

const normalizeUrl = (value) => {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return url.toString();
  } catch {
    return null;
  }
};

const decodeHtml = (value) => value
  .replace(/&amp;/g, '&')
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'")
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>');

const readMeta = (html, property) => {
  const pattern = new RegExp(
    `<meta\\s+(?:[^>]*?\\s)?(?:property|name)=["']${property}["'][^>]*content=["']([^"']*)["'][^>]*>`
    + `|<meta\\s+(?:[^>]*?\\s)?content=["']([^"']*)["'][^>]*(?:property|name)=["']${property}["'][^>]*>`,
    'i'
  );
  const match = html.match(pattern);
  return decodeHtml(match?.[1] ?? match?.[2] ?? '').trim();
};

const readDocumentTitle = (html) => {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return decodeHtml(match?.[1] ?? '').replace(/\s+/g, ' ').trim();
};

const fetchJson = async (url, signal) => {
  const response = await fetch(url, {
    signal,
    headers: {
      accept: 'application/json',
      'user-agent': 'Mozilla/5.0 (compatible; Astro Whono Link Card/1.0)',
      referer: 'https://www.bilibili.com/'
    }
  });
  if (!response.ok) return null;
  return response.json();
};

const fetchText = async (url, signal) => {
  const response = await fetch(url, {
    signal,
    headers: {
      accept: 'text/html,application/xhtml+xml',
      'user-agent': 'Mozilla/5.0 (compatible; Astro Whono Link Card/1.0)'
    }
  });
  if (!response.ok) return '';
  return response.text();
};

const fetchLinkMetadata = async (url, site) => {
  if (metadataCache.has(url)) return metadataCache.get(url);

  const task = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      if (site?.id === 'bilibili') {
        const bvid = url.match(/\/video\/(BV[0-9A-Za-z]+)/i)?.[1];
        if (bvid) {
          const payload = await fetchJson(
            `https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`,
            controller.signal
          );
          const data = payload?.code === 0 ? payload.data : null;
          if (data) {
            return {
              title: typeof data.title === 'string' ? data.title : ''
            };
          }
        }
      }

      const html = await fetchText(url, controller.signal);
      return {
        title: readMeta(html, 'og:title') || readMeta(html, 'twitter:title') || readDocumentTitle(html)
      };
    } catch {
      return { title: '' };
    } finally {
      clearTimeout(timeout);
    }
  })();

  metadataCache.set(url, task);
  return task;
};

const createInlineElement = (tagName, properties, children = []) => ({
  type: 'paragraph',
  children,
  data: {
    hName: tagName,
    hProperties: properties
  }
});

const createLinkCard = async (node) => {
  const url = normalizeUrl(getAttribute(node, 'url'));
  if (!url) return null;

  const parsedUrl = new URL(url);
  const site = getSite(parsedUrl);
  const metadata = await fetchLinkMetadata(url, site);
  const explicitTitle = getText(node).trim() || getAttribute(node, 'title');
  const title = explicitTitle || metadata.title || site?.label || parsedUrl.hostname;
  const className = ['link-card'];
  if (site) className.push(`link-card--${site.id}`);

  const body = [
    createInlineElement('span', { className: ['link-card__title'] }, [text(title)])
  ];

  return {
    properties: {
    href: url,
    className,
    target: '_blank',
    rel: ['nofollow', 'noopener', 'noreferrer']
    },
    children: [
    createInlineElement('span', { className: ['link-card__body'] }, body),
    createInlineElement('span', { className: ['link-card__arrow'], 'aria-hidden': 'true' }, [text('→')])
    ]
  };
};

export default function remarkLinkCard() {
  return async (tree) => {
    const directives = [];
    visit(tree, 'leafDirective', (node) => {
      if (node.name !== 'link-card') return;
      directives.push(node);
    });

    for (const node of directives) {
      const card = await createLinkCard(node);

      if (!card) return;
      node.data = {
        ...(node.data || {}),
        hName: 'a',
        hProperties: card.properties
      };
      node.children = card.children;
    }
  };
}
