import { Marked, type Token, type Tokens } from 'marked';
import { decodeHTML } from 'entities';

export const slugifyHeading = (text: string) => text.toLowerCase().trim()
  .replace(/[^\p{Letter}\p{Number}\u4e00-\u9fff]+/gu, '-').replace(/^-+|-+$/g, '') || 'section';

// One lexer supplies both reference lookup and rendering. Code fences and inline
// code are opaque; authored reference markers are only removed from prose.
export function parseMarkdownSource(markdown: string) {
  const md = new Marked({ gfm: true, breaks: true });
  md.use({
    extensions: [
      // Alt text is plain text, not a second rich-content rendering surface.
      { name: 'image', childTokens: [], renderer: () => false },
      {
        name: 'embedBlock', level: 'block', start: (src) => src.indexOf('![['),
        tokenizer(src) {
          const match = /^ {0,3}!\[\[([^\]\n]+)\]\][ \t]*(?:\n|$)/.exec(src);
          if (match) return { type: 'embedBlock', raw: match[0], source: match[1] };
        },
        renderer: (token) => token.rendered,
      },
      {
        name: 'embedInline', level: 'inline', start: (src) => src.indexOf('![['),
        tokenizer(src) {
          const match = /^!\[\[([^\]\n]+)\]\]/.exec(src);
          if (match) return { type: 'embedInline', raw: match[0], source: match[1] };
        },
        renderer: (token) => token.rendered,
      },
      {
        name: 'contentReference', level: 'inline', start: (src) => src.indexOf('[['),
        tokenizer(src) {
          const match = /^\[\[([^\]\n]+)\]\]/.exec(src);
          if (match) return { type: 'contentReference', raw: match[0], source: match[1] };
        },
        renderer: (token) => token.rendered,
      },
      {
        name: 'highlight', level: 'inline', start: (src) => src.indexOf('=='),
        tokenizer(src) {
          const match = /^==(?=\S)([^\n]+?\S|\S)==(?![=])/.exec(src);
          if (match) return { type: 'highlight', raw: match[0], tokens: this.lexer.inlineTokens(match[1]) };
        },
        renderer(token) { return `<mark>${this.parser.parseInline(token.tokens ?? [])}</mark>`; },
        childTokens: ['tokens'],
      },
      {
        name: 'mathBlock', level: 'block', start: (src) => src.indexOf('$$'),
        tokenizer(src) {
          const match = /^ {0,3}\$\$[ \t]*\n([\s\S]+?)\n {0,3}\$\$[ \t]*(?:\n|$)/.exec(src)
            ?? /^ {0,3}\$\$([^\n]+?)\$\$[ \t]*(?:\n|$)/.exec(src);
          if (match) return { type: 'mathBlock', raw: match[0], text: match[1].trim() };
        },
        renderer: (token) => token.rendered,
      },
      {
        name: 'mathInline', level: 'inline', start: (src) => src.indexOf('$'),
        tokenizer(src) {
          const match = /^\$(?![\s$])((?:\\[^\n]|[^$\\\n])+?)\$(?!\d)/.exec(src);
          if (match && !/\s$/.test(match[1])) return { type: 'mathInline', raw: match[0], text: match[1] };
        },
        renderer: (token) => token.rendered,
      },
      {
        name: 'callout', childTokens: ['tokens', 'titleTokens'],
        renderer(token) {
          const title = token.titleTokens.length ? `<${token.fold ? 'summary' : 'div'} class="callout-title">${this.parser.parseInline(token.titleTokens)}</${token.fold ? 'summary' : 'div'}>` : '';
          const tag = token.fold ? 'details' : 'aside';
          return `<${tag} class="article-callout callout-${token.color}"${token.fold === '+' ? ' open' : ''}>${title}<div class="callout-body">${this.parser.parse(token.tokens ?? [])}</div></${tag}>`;
        },
      },
    ],
  });
  const tokens = md.lexer(markdown);
  const inlineLexer = new md.Lexer(md.defaults);
  inlineLexer.tokens.links = tokens.links;
  // Work on parsed quotes, rather than source regex replacement, so nesting,
  // fences, lists, and quoted literal callout syntax retain their meaning.
  md.walkTokens(tokens, (token) => {
    if (token.type !== 'blockquote') return;
    const quote = token as Tokens.Blockquote;
    const first = quote.tokens[0];
    if (first?.type !== 'paragraph') return;
    const match = /^\[!(red|blue|yellow|green|purple|gary|gray|grey)?\]([+-]?)(?:[ \t]+([^\n]*))?(?:\n|$)/i.exec(first.text);
    if (!match) return;
    const color = /^(gary|grey)$/i.test(match[1] ?? '') ? 'gray' : (match[1]?.toLowerCase() ?? 'blue');
    const body = first.text.slice(match[0].length);
    const remainder = body ? [{ ...first, text: body, raw: body, tokens: inlineLexer.inlineTokens(body) }] : [];
    Object.assign(token, {
      type: 'callout', color, fold: match[2],
      titleTokens: inlineLexer.inlineTokens(match[3]?.trim() || (match[2] ? '提示' : '')),
      tokens: [...remainder, ...quote.tokens.slice(1)],
    });
  });
  const headings: SourceHeading[] = [];
  const blocks = new Map<string, Token[]>();
  const duplicates = new Set<string>();
  const counts = new Map<string, number>();
  const addBlock = (id: string, token: Token, selection: Token[] = [token]) => {
    if (blocks.has(id)) duplicates.add(id);
    blocks.set(id, selection);
    ((token as AnchoredToken).blockAnchors ??= []).push(`block-${id}`);
  };
  const visit = (items: Token[], list?: Tokens.List) => {
    for (let i = 0; i < items.length; i++) {
      const token = items[i];
      if (token.type === 'paragraph' || token.type === 'text') {
        const prose = token as Tokens.Paragraph;
        const last = prose.tokens?.at(-1);
        const match = /(?:^|[ \t\n]+)\^([a-zA-Z0-9-]+)[ \t]*$/.exec(prose.text);
        // An inline-code example ending in ^id is not a block definition.
        if (match && last?.type === 'text' && /(?:^|\s)\^[a-zA-Z0-9-]+[ \t]*$/.test(last.raw)) {
          const text = prose.text.slice(0, match.index).trimEnd();
          if (!text) {
            let previous = i - 1;
            while (items[previous]?.type === 'space') previous--;
            const owner = items[previous];
            if (owner && !['heading', 'def'].includes(owner.type)) {
              addBlock(match[1], owner);
              items.splice(i--, 1);
              continue;
            }
          } else {
            prose.text = text;
            prose.tokens = inlineLexer.inlineTokens(text);
            // A list-item fragment retains its bullet/checkbox container.
            const itemIndex = list?.items.findIndex((item) => item.tokens.includes(token)) ?? -1;
            const selection = list && itemIndex >= 0 ? [{ ...list, start: typeof list.start === 'number' ? list.start + itemIndex : list.start, items: [{ ...list.items[itemIndex], tokens: [token] }] }] : [token];
            addBlock(match[1], token, selection);
          }
        }
      }
      if (token.type === 'heading') {
        const title = token as Tokens.Heading;
        const text = inlineText(title.tokens);
        const slug = slugifyHeading(text);
        const count = (counts.get(slug) ?? 0) + 1;
        counts.set(slug, count);
        headings.push({ token: title, id: `article-${slug}-${count}`, text, depth: title.depth });
      }
      if (token.type === 'list') {
        for (const item of (token as Tokens.List).items) visit(item.tokens, token as Tokens.List);
      } else if ((token.type === 'blockquote' || token.type === 'callout') && Array.isArray(token.tokens)) {
        visit(token.tokens);
      }
    }
  };
  visit(tokens);
  md.walkTokens(tokens, (token) => {
    const anchored = token as AnchoredToken;
    if (anchored.blockAnchors) anchored.blockAnchors = anchored.blockAnchors.filter((id) => !duplicates.has(id.slice('block-'.length)));
  });
  return { md, tokens, headings, blocks, duplicates };
}

export interface SourceHeading { token: Tokens.Heading; id: string; text: string; depth: number }
export type MarkdownSource = ReturnType<typeof parseMarkdownSource>;
export type AnchoredToken = Token & { blockAnchors?: string[] };
export interface ContentTarget { kind: 'heading' | 'block'; id: string; label: string; tokens: Token[] }

function inlineText(tokens: Token[]): string {
  return tokens.map((token) => {
    if (token.type === 'contentReference' || token.type === 'embedInline') {
      const [ref, ...label] = String(token.source).split('|');
      return label.join('|') || ref;
    }
    if (token.type === 'mathInline') return token.text;
    if ('tokens' in token && Array.isArray(token.tokens)) return inlineText(token.tokens);
    if (token.type === 'html') return '';
    return decodeHTML('text' in token && typeof token.text === 'string' ? token.text : token.raw);
  }).join('');
}

export function findContentTarget(source: MarkdownSource, fragment: string): ContentTarget | undefined {
  if (fragment.startsWith('^')) {
    const key = fragment.slice(1);
    const tokens = source.blocks.get(key);
    return tokens && !source.duplicates.has(key) ? { kind: 'block', id: `block-${key}`, label: `^${key}`, tokens } : undefined;
  }
  const path = fragment.split('#').map((part) => part.trim().toLocaleLowerCase());
  if (path.some((part) => !part)) return;
  const ancestors: SourceHeading[] = [];
  for (const heading of source.headings) {
    while (ancestors.length && ancestors.at(-1)!.depth >= heading.depth) ancestors.pop();
    ancestors.push(heading);
    if (ancestors.slice(-path.length).map((item) => item.text.toLocaleLowerCase()).join('#') !== path.join('#')) continue;
    // Top-level headings use the original token range, retaining reference-link
    // definitions from the complete document. Nested headings use their owner.
    const findRange = (items: Token[]): Token[] | undefined => {
      const start = items.indexOf(heading.token);
      if (start >= 0) {
        let end = start + 1;
        while (end < items.length && !(items[end].type === 'heading' && (items[end] as Tokens.Heading).depth <= heading.depth)) end++;
        return items.slice(start, end);
      }
      for (const item of items) {
        const groups = item.type === 'list' ? (item as Tokens.List).items.map((entry) => entry.tokens) : 'tokens' in item && Array.isArray(item.tokens) ? [item.tokens] : [];
        for (const children of groups) { const found = findRange(children); if (found) return found; }
      }
    };
    return { kind: 'heading', id: heading.id, label: heading.text, tokens: findRange(source.tokens)! };
  }
}
