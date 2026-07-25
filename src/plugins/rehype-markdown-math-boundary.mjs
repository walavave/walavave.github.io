const MARKDOWN_MATH_BOUNDARY_NODE_TYPE = 'astroWhonoMarkdownMath';
const MATH_TRIGGER_CLASSES = new Set(['language-math', 'math-display', 'math-inline']);

const getClassNames = (node) => {
  const className = node.properties?.className;
  if (Array.isArray(className)) return className.map(String);
  if (typeof className === 'string') return className.split(/\s+/).filter(Boolean);
  return [];
};

const setClassNames = (node, classNames) => {
  if (!node.properties) node.properties = {};
  if (classNames.length > 0) {
    node.properties.className = classNames;
    return;
  }
  delete node.properties.className;
};

const textContent = (node) =>
  (node.children ?? [])
    .map((child) => {
      if (child.type === 'text') return child.value;
      if (child.children) return textContent(child);
      return '';
    })
    .join('');

const normalizeNestedInlineMathDelimiters = (value) => {
  let normalized = '';

  for (let index = 0; index < value.length;) {
    if (value[index] !== '\\') {
      normalized += value[index];
      index += 1;
      continue;
    }

    let runLength = 1;
    while (value[index + runLength] === '\\') runLength += 1;

    const delimiter = value[index + runLength];
    if (runLength % 2 === 1 && (delimiter === '(' || delimiter === ')')) {
      normalized += '\\'.repeat(runLength - 1);
      normalized += delimiter === '(' ? '{' : '}';
      index += runLength + 1;
      continue;
    }

    normalized += '\\'.repeat(runLength);
    index += runLength;
  }

  return normalized;
};

const mapChildren = (node, mapper) => {
  if (Array.isArray(node.children)) {
    node.children = node.children.map((child) => mapper(child));
  }
  return node;
};

const createTrustedMathNode = (node, code, displayMode) => ({
  type: MARKDOWN_MATH_BOUNDARY_NODE_TYPE,
  // Some LaTeX producers wrap groups in \(...\) even inside an existing math block.
  // KaTeX rejects nested math mode, while braces preserve the intended grouping.
  value: normalizeNestedInlineMathDelimiters(textContent(code)),
  displayMode,
  position: node.position
});

const restoreTrustedMathNode = (node) => {
  if (node.displayMode) {
    return {
      type: 'element',
      tagName: 'pre',
      properties: {},
      children: [
        {
          type: 'element',
          tagName: 'code',
          properties: { className: ['language-math', 'math-display'] },
          children: [{ type: 'text', value: node.value }],
          position: node.position
        }
      ],
      position: node.position
    };
  }

  return {
    type: 'element',
    tagName: 'code',
    properties: { className: ['language-math', 'math-inline'] },
    children: [{ type: 'text', value: node.value }],
    position: node.position
  };
};

export const markdownMathRawOptions = {
  passThrough: [MARKDOWN_MATH_BOUNDARY_NODE_TYPE]
};

const protectMarkdownMath = (tree, isTrustedNode) => {
  const protectNode = (node) => {
    if (node.type !== 'element') return mapChildren(node, protectNode);

    if (node.tagName === 'pre') {
      const code = node.children?.find((child) => child.type === 'element' && child.tagName === 'code');
      if (code && getClassNames(code).includes('math-display') && isTrustedNode(code)) {
        return createTrustedMathNode(node, code, true);
      }
    }

    if (node.tagName === 'code' && getClassNames(node).includes('math-inline') && isTrustedNode(node)) {
      return createTrustedMathNode(node, node, false);
    }

    return mapChildren(node, protectNode);
  };

  tree.children = tree.children.map((child) => protectNode(child));
};

export const rehypeProtectMarkdownMath = () => (tree) => protectMarkdownMath(tree, () => true);

// Unified deduplicates repeated registrations of the same plugin function.
// A distinct attacher is required for math nodes created after rehype-raw.
export const rehypeProtectDetailsMarkdownMath = () => (tree) =>
  protectMarkdownMath(tree, (node) => node.properties?.dataDetailsMarkdownMath === true);

export const rehypeRestoreMarkdownMathBoundary = () => (tree) => {
  const restoreNode = (node) => {
    if (node.type === MARKDOWN_MATH_BOUNDARY_NODE_TYPE) {
      return restoreTrustedMathNode(node);
    }

    if (node.type === 'element') {
      const classNames = getClassNames(node).filter((className) => !MATH_TRIGGER_CLASSES.has(className));
      setClassNames(node, classNames);
    }

    return mapChildren(node, restoreNode);
  };

  tree.children = tree.children.map((child) => restoreNode(child));
};

export const rehypeNumberDisplayEquations = () => (tree) => {
  let equationNumber = 0;

  const numberNode = (node) => {
    if (node.type !== 'element') return;

    if (node.tagName === 'pre') {
      const code = node.children?.find((child) => child.type === 'element' && child.tagName === 'code');
      if (code && getClassNames(code).includes('math-display')) {
        code.children = (code.children ?? []).map((child) => {
          if (child.type !== 'text') return child;
          return {
            ...child,
            value: child.value.replace(
              /\\begin\{equation\}([\s\S]*?)\\end\{equation\}/g,
              (environment, body) => {
                equationNumber += 1;
                if (/\\tag\s*\{/.test(body)) return environment;
                return `\\begin{equation}${body.trimEnd()}\n\\tag{${equationNumber}}\n\\end{equation}`;
              }
            )
          };
        });
      }
    }

    node.children?.forEach(numberNode);
  };

  tree.children.forEach(numberNode);
};
