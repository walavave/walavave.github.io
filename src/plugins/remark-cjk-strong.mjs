const splitStrongText = (node, source) => {
  const value = node.value;
  const raw = Number.isInteger(node.position?.start?.offset) && Number.isInteger(node.position?.end?.offset)
    ? source.slice(node.position.start.offset, node.position.end.offset)
    : value;

  // If Markdown escapes or entities changed the text, leave the parser's result intact.
  if (raw !== value) return [node];

  const children = [];
  const pattern = /\*\*([^*\n]+?)\*\*/g;
  const cjk = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
  let cursor = 0;
  let match;

  while ((match = pattern.exec(value))) {
    const openingIndex = match.index;
    const closingIndex = openingIndex + match[0].length - 2;
    const before = value[openingIndex - 1] ?? '';
    const after = value[pattern.lastIndex] ?? '';
    if (
      before === '\\'
      || value[closingIndex - 1] === '\\'
      || match[1].trim() !== match[1]
      || !cjk.test(before)
      || !cjk.test(after)
    ) {
      continue;
    }

    if (openingIndex > cursor) {
      children.push({ type: 'text', value: value.slice(cursor, openingIndex) });
    }
    children.push({
      type: 'strong',
      children: [{ type: 'text', value: match[1] }]
    });
    cursor = pattern.lastIndex;
  }

  if (cursor === 0) return [node];
  if (cursor < value.length) children.push({ type: 'text', value: value.slice(cursor) });
  return children;
};

export const remarkCjkStrong = () => (tree, file) => {
  const source = String(file.value ?? '');

  const transformChildren = (node) => {
    if (!Array.isArray(node.children)) return;
    node.children = node.children.flatMap((child) => {
      if (child.type === 'text') return splitStrongText(child, source);
      transformChildren(child);
      return [child];
    });
  };

  transformChildren(tree);
};
