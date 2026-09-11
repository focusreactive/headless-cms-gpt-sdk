import type { ISbRichtext } from "storyblok-js-client";

/** What a block's inline content becomes on its way to the model, and back. */
export interface MarkedBlock {
  /**
   * The block's text as one string, with everything that is not plain text
   * standing in as a numbered marker:
   *   - formatted text — `<1>the words</1>`
   *   - anything without text of its own — `<2/>`
   *
   * Unformatted text appears as itself, unmarked.
   */
  text: string;
  /**
   * The node each marker number stands for. The number, not the position, is the
   * identity: a marker may come back somewhere else in the sentence.
   */
  nodes: Record<number, ISbRichtext>;
}

/**
 * Turns a block's inline content into text the model can translate as one
 * sentence.
 *
 * Numbering takes the lowest free numbers from 1 up. A number is taken when the
 * serialised text reads it in any of the three forms — `<7>`, `</7>` or `<7/>` —
 * including a sequence formed only where two nodes meet —
 * because such text is content, not a marker, and must survive translation as
 * itself. It is left alone, never escaped: only the choice of number keeps the two
 * apart.
 *
 * Order follows the content.
 *
 * Formatting never nests in Storyblok: several marks live on one text node, so a
 * bold link is one marker, not two.
 */
export type SerializeInline = (
  content: readonly ISbRichtext[],
) => MarkedBlock;

/**
 * Turns the model's answer back into inline content.
 *
 * Every marker the block went out with must come back exactly once, opened and
 * closed, with its own number. Anything else — a marker dropped, doubled, left
 * unclosed, or one that was never sent — means the answer cannot be trusted to
 * describe this block, and `null` is returned rather than a half-rebuilt tree.
 * A sequence the block carried as content is not a marker and not a mismatch: it
 * reads as the text it always was.
 *
 * What comes back is not the shape that went out: a translation may need fewer
 * nodes than the source, or more. Text outside every marker becomes a plain text
 * node — `{ type: "text", text }`, with no marks; text inside a marker becomes that
 * marker's node carrying the new text; a self-closing marker becomes its node
 * unchanged.
 *
 * A marker that comes back holding nothing (`<1></1>`) is still an answer: its node
 * is rebuilt with empty text. Refusing here would throw away a whole block over one
 * word the model chose to drop.
 *
 * Markers never nest. One appearing inside another is an answer about a block this
 * is not, and refused like any other mismatch.
 *
 * An empty answer to a block that held text is refused: a translation that came back
 * as nothing would otherwise erase the block. Only an empty block accepts it.
 *
 * Nodes are rebuilt, never shared with `nodes` — a caller may parse the same
 * `MarkedBlock` for two locales without one polluting the other.
 */
export type ParseInline = (
  translated: string,
  block: MarkedBlock,
) => ISbRichtext[] | null;

const opening = (index: number) => `<${index}>`;
const closing = (index: number) => `</${index}>`;
const selfClosing = (index: number) => `<${index}/>`;

const textOf = (node: ISbRichtext) =>
  typeof node.text === "string" ? node.text : undefined;

const isPlainText = (node: ISbRichtext) =>
  textOf(node) !== undefined && !node.marks?.length;

export const serializeInline: SerializeInline = (content) => {
  // Joined, not per node: a sequence can be formed where two plain nodes meet, and
  // that one reads as a marker just as well once the block is one string.
  const sourceText = content.map((node) => textOf(node) ?? "").join("");
  const taken = (index: number) =>
    sourceText.includes(opening(index)) ||
    sourceText.includes(closing(index)) ||
    sourceText.includes(selfClosing(index));

  const nodes: Record<number, ISbRichtext> = {};
  let candidate = 1;
  const takeNumber = () => {
    while (taken(candidate)) {
      candidate += 1;
    }

    return candidate++;
  };

  const text = content
    .map((node) => {
      if (isPlainText(node)) {
        return textOf(node) as string;
      }

      const index = takeNumber();
      nodes[index] = node;
      const own = textOf(node);

      return own === undefined
        ? selfClosing(index)
        : `${opening(index)}${own}${closing(index)}`;
    })
    .join("");

  return { text, nodes };
};

/** Strips marker syntax for display: markers must never reach a person. */
export const withoutMarkers = (text: string) =>
  text.replace(/<\/?\d+\/?>/g, "");

export const parseInline: ParseInline = (translated, block) => {
  if (translated === "" && block.text !== "") {
    return null;
  }

  const expected = new Set(Object.keys(block.nodes).map(Number));
  const seen = new Set<number>();
  const result: ISbRichtext[] = [];

  const pushText = (value: string) => {
    if (value) {
      result.push({ type: "text", text: value } as ISbRichtext);
    }
  };

  const rebuild = (index: number, value?: string) => {
    const source = block.nodes[index];
    const rebuilt = structuredClone(source);

    if (value !== undefined) {
      rebuilt.text = value;
    }

    result.push(rebuilt);
  };

  const marker = /<(\d+)>|<\/(\d+)>|<(\d+)\/>/g;
  let cursor = 0;
  let open: { index: number; textFrom: number } | undefined;

  for (let match = marker.exec(translated); match; match = marker.exec(translated)) {
    const [token, opens, closes, alone] = match;
    const index = Number(opens ?? closes ?? alone);

    if (!expected.has(index)) {
      const wasContentInSource = block.text.includes(token);

      if (wasContentInSource) {
        continue;
      }

      return null;
    }

    // Inside an open marker the only token that can follow is its own closing tag,
    // and that text is taken from open.textFrom — flushing here would emit it twice.
    if (open === undefined) {
      pushText(translated.slice(cursor, match.index));
    }

    if (alone !== undefined || opens !== undefined) {
      if (open !== undefined || seen.has(index)) {
        return null;
      }

      seen.add(index);
    }

    if (alone !== undefined) {
      rebuild(index);
    } else if (opens !== undefined) {
      open = { index, textFrom: match.index + token.length };
    } else {
      if (open?.index !== index) {
        return null;
      }

      rebuild(index, translated.slice(open.textFrom, match.index));
      open = undefined;
    }

    cursor = match.index + token.length;
  }

  if (open !== undefined || seen.size !== expected.size) {
    return null;
  }

  pushText(translated.slice(cursor));

  return result;
};
