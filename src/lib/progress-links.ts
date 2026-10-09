export type ProgressTaskTextPart =
  | { type: 'text'; value: string }
  | { type: 'link'; value: string; href: string };

const PROGRESS_LINK_RE = /\[([^\]]+)\]\(([^\s)]+)\)/g;

const isSafeProgressHref = (value: string): boolean => {
  const href = value.trim();
  if (!href || /^(?:javascript|data|vbscript):/i.test(href)) return false;
  if (/^(?:https?:|mailto:|tel:|\/|\.\.?\/|#)/i.test(href)) return true;
  return !/^[a-z][a-z\d+.-]*:/i.test(href);
};

export const parseProgressTaskText = (value: string): ProgressTaskTextPart[] => {
  const parts: ProgressTaskTextPart[] = [];
  let cursor = 0;

  for (const match of value.matchAll(PROGRESS_LINK_RE)) {
    const index = match.index ?? 0;
    const label = match[1]?.trim() ?? '';
    const href = match[2]?.trim() ?? '';
    if (!label || !isSafeProgressHref(href)) continue;
    if (index > cursor) parts.push({ type: 'text', value: value.slice(cursor, index) });
    parts.push({ type: 'link', value: label, href });
    cursor = index + match[0].length;
  }

  if (cursor < value.length) parts.push({ type: 'text', value: value.slice(cursor) });
  return parts.length > 0 ? parts : [{ type: 'text', value }];
};
