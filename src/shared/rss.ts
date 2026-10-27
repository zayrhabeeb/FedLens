/**
 * Dependency-free RSS 2.0 / RSS 1.0 (RDF) / Atom parser.
 *
 * It is regex-based rather than DOMParser-based so the exact same code runs in
 * the extension and in the Node snapshot script, and so it is unit-testable.
 * Feeds are treated as untrusted input: all markup is stripped from text fields.
 */

export interface FeedItem {
  title: string;
  link: string;
  /** ISO-8601, or '' when the feed omits a date. */
  publishedAt: string;
  description: string;
  /** Publisher name when the feed carries one (e.g. Google News <source>). */
  source?: string;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
  hellip: '…',
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === '#') {
      const n =
        code[1]?.toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : match;
    }
    return NAMED_ENTITIES[code.toLowerCase()] ?? match;
  });
}

/** Remove HTML tags and collapse whitespace. Input may itself be entity-encoded HTML. */
export function stripHtml(html: string): string {
  const decoded = decodeEntities(html);
  return decodeEntities(decoded.replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function unwrapCdata(text: string): string {
  return text.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
}

/** Text content of the first matching element; supports namespaced names like dc:date. */
function tagText(block: string, tag: string): string | undefined {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i');
  const match = re.exec(block);
  return match?.[1] === undefined ? undefined : unwrapCdata(match[1]).trim();
}

function atomLink(block: string): string | undefined {
  const alternate = /<link\b[^>]*rel=["']alternate["'][^>]*>/i.exec(block)?.[0];
  const anyLink = alternate ?? /<link\b[^>]*href=["'][^"']+["'][^>]*>/i.exec(block)?.[0];
  return anyLink ? /href=["']([^"']+)["']/i.exec(anyLink)?.[1] : undefined;
}

function toIso(date: string | undefined): string {
  if (!date) return '';
  const ms = Date.parse(date.trim());
  return Number.isNaN(ms) ? '' : new Date(ms).toISOString();
}

export function parseFeed(xml: string): FeedItem[] {
  const blocks = xml.match(/<(item|entry)\b[\s\S]*?<\/\1>/gi) ?? [];
  const items: FeedItem[] = [];
  for (const block of blocks) {
    const title = stripHtml(tagText(block, 'title') ?? '');
    const link = decodeEntities(tagText(block, 'link') || atomLink(block) || '').trim();
    if (!title || !/^https?:\/\//i.test(link)) continue;
    const description = stripHtml(
      tagText(block, 'description') ?? tagText(block, 'summary') ?? tagText(block, 'content') ?? '',
    );
    const date =
      tagText(block, 'pubDate') ??
      tagText(block, 'dc:date') ??
      tagText(block, 'published') ??
      tagText(block, 'updated');
    const source = tagText(block, 'source');
    items.push({
      title,
      link,
      publishedAt: toIso(date),
      description,
      ...(source ? { source: stripHtml(source) } : {}),
    });
  }
  return items;
}
