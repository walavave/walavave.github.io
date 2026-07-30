import GithubSlugger from 'github-slugger';
import { MARKDOWN_MATH_STYLESHEET_HREF } from '../lib/markdown-math-styles';

type TocHeading = {
  depth: number;
  id: string;
  text: string;
  element: HTMLHeadingElement;
};

const COMPONENT_NAME = 'article-toc';

const styles = `
  :host { display: block; margin: 6px 0 8px; font-family: var(--font-readable); }
  details { border: 1px solid var(--border); border-radius: 7px; background: color-mix(in srgb, var(--panel) 45%, var(--bg)); }
  summary { padding: 5px 12px; color: var(--text); font-size: 15px; font-weight: 600; cursor: pointer; user-select: none; }
  nav { padding: 0 16px 12px 32px; }
  ul { margin: 0; padding-left: 17px; list-style: none; }
  nav > ul { padding-left: 0; }
  li { margin: 0; }
  a { color: var(--muted); font-size: 13px; line-height: 1; text-decoration: none; }
  a:hover, a:focus-visible { color: var(--accent); }
`;

export const appendHeadingContent = (link: HTMLAnchorElement, heading: HTMLHeadingElement) => {
  const content = heading.cloneNode(true) as HTMLHeadingElement;

  // A TOC entry is already a link, so preserve linked labels without nesting anchors.
  content.querySelectorAll('a').forEach((anchor) => anchor.replaceWith(...anchor.childNodes));
  content.querySelectorAll('[id]').forEach((element) => element.removeAttribute('id'));
  link.append(...content.childNodes);
};

const getHeadings = (root: Element): TocHeading[] => {
  const slugger = new GithubSlugger();
  return Array.from(root.querySelectorAll<HTMLHeadingElement>('h2, h3, h4, h5, h6'))
    .map((element) => {
      const text = element.textContent?.trim() ?? '';
      if (text && !element.id) element.id = slugger.slug(text);
      else if (text) slugger.slug(text);
      return { depth: Number(element.tagName.slice(1)), id: element.id, text, element };
    })
    .filter((heading) => heading.text && heading.id);
};

const createList = (headings: TocHeading[]) => {
  const root = document.createElement('ul');
  const stack = [{ depth: headings[0]?.depth ?? 2, list: root, lastItem: null as HTMLLIElement | null }];

  for (const heading of headings) {
    while (stack.length > 1 && heading.depth <= stack[stack.length - 1]!.depth) stack.pop();
    let current = stack[stack.length - 1]!;
    if (heading.depth > current.depth && current.lastItem) {
      const nested = document.createElement('ul');
      current.lastItem.append(nested);
      current = { depth: heading.depth, list: nested, lastItem: null };
      stack.push(current);
    }
    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = `#${encodeURIComponent(heading.id)}`;
    appendHeadingContent(link, heading.element);
    item.append(link);
    current.list.append(item);
    current.lastItem = item;
  }

  return root;
};

class ArticleToc extends HTMLElement {
  connectedCallback() {
    window.requestAnimationFrame(() => this.render());
  }

  private render() {
    const article = this.closest('.prose');
    if (!article) return;
    const headings = getHeadings(article);
    if (!headings.length) {
      this.hidden = true;
      return;
    }
    this.hidden = false;

    const shadow = this.shadowRoot ?? this.attachShadow({ mode: 'open' });
    shadow.replaceChildren();
    if (headings.some(({ element }) => element.querySelector('.katex'))) {
      const katexStylesheet = document.createElement('link');
      katexStylesheet.rel = 'stylesheet';
      katexStylesheet.href = MARKDOWN_MATH_STYLESHEET_HREF;
      shadow.append(katexStylesheet);
    }
    const style = document.createElement('style');
    style.textContent = styles;
    const details = document.createElement('details');
    details.open = true;
    const summary = document.createElement('summary');
    summary.textContent = '目录';
    const nav = document.createElement('nav');
    nav.setAttribute('aria-label', '文章目录');
    nav.append(createList(headings));
    details.append(summary, nav);
    shadow.append(style, details);
  }
}

if (!customElements.get(COMPONENT_NAME)) customElements.define(COMPONENT_NAME, ArticleToc);
