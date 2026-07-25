import remarkMath from 'remark-math';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';
import { remarkCjkStrong } from './remark-cjk-strong.mjs';

const detailsTextProcessor = unified()
  .use(remarkParse)
  .use(remarkMath, { singleDollarTextMath: true })
  .use(remarkCjkStrong)
  .use(remarkRehype);

const containsMathNode = (node) =>
  node.type === 'math'
  || node.type === 'inlineMath'
  || node.children?.some(containsMathNode) === true;

const preserveBoundaryWhitespace = (value, children) => {
  const leading = value.match(/^\s+/)?.[0] ?? '';
  const trailing = value.match(/\s+$/)?.[0] ?? '';
  const result = [...children];

  if (leading && !(result[0]?.type === 'text' && /^\s/.test(result[0].value))) {
    result.unshift({ type: 'text', value: leading });
  }
  if (trailing && !(result.at(-1)?.type === 'text' && /\s$/.test(result.at(-1).value))) {
    result.push({ type: 'text', value: trailing });
  }
  return result;
};

const parseDetailsText = (value, inline = false) => {
  const mdast = detailsTextProcessor.parse(value);
  if (!containsMathNode(mdast)) return null;

  const children = detailsTextProcessor.runSync(mdast, value).children;

  const markMathNodes = (node) => {
    if (node.type !== 'element') return;
    const classNames = Array.isArray(node.properties?.className) ? node.properties.className : [];
    if (classNames.includes('math-inline') || classNames.includes('math-display')) {
      node.properties.dataDetailsMarkdownMath = true;
    }
    node.children?.forEach(markMathNodes);
  };

  children.forEach(markMathNodes);
  if (inline) {
    const inlineChildren = children.flatMap((child) =>
      child.type === 'element' && child.tagName === 'p' ? child.children : [child]
    );
    return preserveBoundaryWhitespace(value, inlineChildren);
  }
  return children;
};

export const rehypeDetailsMarkdown = () => (tree) => {
  const transformNode = (node, markdownContext = null) => {
    if (node.type !== 'element' || !Array.isArray(node.children)) return;

    const isDetails = node.tagName === 'details';
    const childContext = isDetails ? 'body' : markdownContext;
    const hasInlineElementSiblings = node.children.some((child) =>
      child.type === 'element' && child.tagName !== 'summary'
    );

    node.children = node.children.flatMap((child) => {
      if (childContext && child.type === 'text' && child.value.trim()) {
        return parseDetailsText(
          child.value,
          childContext === 'summary' || hasInlineElementSiblings
        ) ?? [child];
      }

      if (child.type === 'element' && child.tagName !== 'code' && child.tagName !== 'pre') {
        const nextContext = isDetails && child.tagName === 'summary' ? 'summary' : childContext;
        transformNode(child, nextContext);
      }
      return [child];
    });
  };

  tree.children.forEach((child) => transformNode(child));
};
