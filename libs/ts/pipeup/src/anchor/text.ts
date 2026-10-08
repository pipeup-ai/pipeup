/** All text under a node, with where each text node starts. Offsets match Range#toString(). */
export interface TextIndex {
  text: string;
  nodes: { node: Text; start: number }[];
}

export function indexText(root: Node): TextIndex {
  const doc = root.ownerDocument ?? (root as Document);
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: TextIndex["nodes"] = [];
  let text = "";
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    nodes.push({ node: n as Text, start: text.length });
    text += (n as Text).data;
  }
  return { text, nodes };
}

/** Character offset of a DOM position within root's text. */
export function textOffset(root: Node, container: Node, offset: number): number {
  const doc = root.ownerDocument ?? (root as Document);
  const range = doc.createRange();
  range.setStart(root, 0);
  range.setEnd(container, offset);
  return range.toString().length;
}

export function rangeFromOffsets(index: TextIndex, start: number, end: number): Range | null {
  const s = locate(index, start, false);
  const e = locate(index, end, true);
  if (!s || !e || end < start) return null;
  const range = s.node.ownerDocument.createRange();
  range.setStart(s.node, s.offset);
  range.setEnd(e.node, e.offset);
  return range;
}

function locate(index: TextIndex, pos: number, isEnd: boolean): { node: Text; offset: number } | undefined {
  const entry = index.nodes.find((n) => pos >= n.start && pos < n.start + n.node.data.length + Number(isEnd));
  return entry && { node: entry.node, offset: pos - entry.start };
}
