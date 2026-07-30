import { describe, expect, it, vi } from 'vitest';

describe('article TOC heading content', () => {
  it('preserves rendered KaTeX markup while removing nested links and duplicate ids', async () => {
    vi.stubGlobal('HTMLElement', class {});
    vi.stubGlobal('customElements', {
      get: vi.fn(() => undefined),
      define: vi.fn()
    });

    const { appendHeadingContent } = await import('../src/scripts/article-toc');
    const linkedLabel = { nodeName: '#text' };
    const nestedAnchor = {
      childNodes: [linkedLabel],
      replaceWith: vi.fn()
    };
    const duplicateId = { removeAttribute: vi.fn() };
    const text = { nodeName: '#text' };
    const katex = { nodeName: 'SPAN', className: 'katex' };
    const clonedHeading = {
      childNodes: [text, katex],
      querySelectorAll: vi.fn((selector: string) => selector === 'a' ? [nestedAnchor] : [duplicateId])
    };
    const heading = {
      cloneNode: vi.fn(() => clonedHeading)
    };
    const link = { append: vi.fn() };

    appendHeadingContent(
      link as unknown as HTMLAnchorElement,
      heading as unknown as HTMLHeadingElement
    );

    expect(heading.cloneNode).toHaveBeenCalledWith(true);
    expect(nestedAnchor.replaceWith).toHaveBeenCalledWith(linkedLabel);
    expect(duplicateId.removeAttribute).toHaveBeenCalledWith('id');
    expect(link.append).toHaveBeenCalledWith(text, katex);

    vi.unstubAllGlobals();
  });
});
