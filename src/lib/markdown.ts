import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { Marked, type Token, type Tokens, type TokensList } from 'marked';
import sanitizeHtml from 'sanitize-html';
import { decodeHTML } from 'entities';
import { createMarkdownResources, renderFileEmbed, type MarkdownResources } from './markdown-embeds';
import { createMathRenderer, escapeHtml, renderCode, renderPele, renderSourceError } from './markdown-rich';

export interface ArticleSection {
  heading?: { id: string; level: number; text: string; html?: string };
  html: string;
}

export interface RenderedArticle {
  sections: ArticleSection[];
  searchText: string;
  wordCount: number;
  readingTime: number;
}

const slugifyHeading = (text: string) => text.toLowerCase().trim()
  .replace(/[^\p{Letter}\p{Number}\u4e00-\u9fff]+/gu, '-').replace(/^-+|-+$/g, '') || 'section';
const stripHtml = (html: string) => decodeHTML(sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }));

const sanitizeArticleHtml = (html: string) => sanitizeHtml(html, {
  allowedTags: [...sanitizeHtml.defaults.allowedTags,
    'img', 'figure', 'figcaption', 'details', 'summary', 'kbd', 'mark', 'del', 'input'],
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    a: ['href', 'title', 'target', 'rel', 'download', 'class'],
    img: ['src', 'alt', 'title', 'width', 'height', 'loading', 'decoding'],
    code: ['class', 'title'], div: ['class', 'role', 'tabindex', 'aria-expanded', 'aria-label'], figure: ['class'], span: ['class', 'aria-hidden'],
    aside: ['class'], details: ['class', 'open'], summary: ['class'],
    input: ['type', 'checked', 'disabled', 'aria-label'],
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['http', 'https'] },
  allowProtocolRelative: false,
  transformTags: {
    a: (_tag, attrs) => ({ tagName: 'a', attribs: /^https?:\/\//i.test(attrs.href ?? '')
      ? { ...attrs, target: '_blank', rel: 'noreferrer noopener' } : attrs }),
    img: (_tag, attrs) => ({ tagName: 'img', attribs: { ...attrs, loading: 'lazy', decoding: 'async' } }),
    input: (_tag, attrs) => ({ tagName: 'input', attribs: {
      type: 'checkbox', disabled: '', 'aria-label': attrs.checked === undefined ? '未完成' : '已完成',
      ...(attrs.checked === undefined ? {} : { checked: '' }),
    } }),
  },
});

export interface MarkdownOptions {
  resources?: MarkdownResources;
  documentKey?: string;
  embedStack?: string[];
}

export async function renderArticleMarkdown(markdown: string, options: MarkdownOptions = {}): Promise<RenderedArticle> {
  const fragments = new Map<string, string>();
  let embedNumber = 0;
  const fragmentText = new Map<string, string>();
  const prefix = `BLOG_RENDER_${randomUUID().replaceAll('-', '')}_`;
  const protect = (html: string, text = '') => {
    const key = `${prefix}${fragments.size}_END`;
    fragments.set(key, html);
    fragmentText.set(key, text);
    return key;
  };
  const clean = (html: string) => {
    // Sanitize authored HTML first. Only fragments created by the renderers can
    // bypass the HTML allowlist; the random per-render keys cannot be authored.
    let result = sanitizeArticleHtml(html);
    for (const [key, value] of fragments) result = result.replaceAll(key, () => value);
    return result;
  };
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
        name: 'wikilink', level: 'inline', start: (src) => src.indexOf('[['),
        tokenizer(src) {
          const match = /^\[\[([^\]\n]+)\]\]/.exec(src);
          if (match) return { type: 'wikilink', raw: match[0], source: match[1] };
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
    renderer: {
      image({ href, title, text }) {
        return `<img src="${escapeHtml(href)}" alt="${escapeHtml(stripHtml(text))}"${title ? ` title="${escapeHtml(title)}"` : ''}>`;
      },
      code(token) { return (token as Tokens.Code & { rendered: string }).rendered; },
      link({ href, title, tokens }) {
        const text = this.parser.parseInline(tokens);
        const external = /^https?:\/\//i.test(href);
        return `<a href="${escapeHtml(href)}"${title ? ` title="${escapeHtml(title)}"` : ''}>${text}${external ? '<span class="external-link-icon" aria-hidden="true"></span>' : ''}</a>`;
      },
    },
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
  let renderMath: ReturnType<typeof createMathRenderer> | undefined;
  // Keep source order for TeX macros, and keep highlighting out of the client.
  const richTokens: Token[] = [];
  md.walkTokens(tokens, (token) => { richTokens.push(token); });
  for (const token of richTokens) {
    if (token.type === 'wikilink') {
      const [reference, ...labels] = (token.source as string).split('|');
      const label = labels.join('|').trim();
      const resources = options.resources ??= createMarkdownResources(resolve('public'));
      const resource = resources.resolveEmbed(reference, options.documentKey);
      if (resource.kind === 'document') {
        token.rendered = `<a class="article-wikilink" href="${escapeHtml(resource.document.href)}">${escapeHtml(label || resource.document.title)}</a>`;
      } else if (resource.kind === 'file') {
        token.rendered = `<a class="article-wikilink article-wikilink-file" href="${escapeHtml(resource.url)}">${escapeHtml(label || resource.name)}</a>`;
      } else {
        token.rendered = `<span class="article-wikilink-missing" title="${escapeHtml(resource.message)}">[[${escapeHtml(token.source as string)}]]</span>`;
      }
    } else if (token.type === 'embedBlock' || token.type === 'embedInline') {
      const [reference, ...labels] = (token.source as string).split('|');
      const label = labels.join('|').trim();
      const resources = options.resources ??= createMarkdownResources(resolve('public'));
      const resource = resources.resolveEmbed(reference, options.documentKey);
      const inline = token.type === 'embedInline';
      if (resource.kind === 'missing') {
        token.rendered = `<span class="article-embed-missing">${escapeHtml(resource.message)}</span>`;
      } else if (resource.kind === 'file') {
        token.rendered = protect(renderFileEmbed(resource, label, inline, `${options.documentKey ?? 'article'}-embed-${embedNumber++}`), label || resource.name);
      } else {
        const note = resource.document;
        const stack = options.embedStack ?? (options.documentKey ? [options.documentKey] : []);
        const link = `<a href="${escapeHtml(note.href)}">${escapeHtml(label || note.title)}</a>`;
        if (inline || stack.includes(note.key) || stack.length >= 4) {
          token.rendered = `<span class="article-embed-reference">${link}${inline ? '' : '（已停止重复或过深的嵌入）'}</span>`;
        } else {
          const embedded = await renderArticleMarkdown(note.markdown, { resources, documentKey: note.key, embedStack: [...stack, note.key] });
          const contents = embedded.sections.map((section) => `${section.heading ? `<h${Math.min(6, section.heading.level + 2)}>${section.heading.html}</h${Math.min(6, section.heading.level + 2)}>` : ''}${section.html}`).join('');
          const embedKey = `${options.documentKey ?? 'article'}-embed-${embedNumber++}`;
          token.rendered = protect(`<div class="article-embed-note" data-embed-key="${escapeHtml(embedKey)}" role="group"><div class="embed-note-summary" role="button" tabindex="0" aria-expanded="true"><span>嵌入文章 · </span><span class="embed-note-title">${escapeHtml(note.title)}</span><span class="embed-note-toggle" aria-hidden="true"></span></div><div class="article-embed-body"><div class="embed-note-source">${link}</div>${contents}</div></div>`, note.title);
        }
      }
    } else if (token.type === 'mathInline' || token.type === 'mathBlock') {
      renderMath ??= createMathRenderer();
      try { token.rendered = protect(await renderMath(token.text, token.type === 'mathBlock'), token.text); }
      catch { token.rendered = token.type === 'mathBlock' ? renderSourceError('公式暂时无法渲染', token.raw) : `<code title="公式语法有误">${escapeHtml(token.raw)}</code>`; }
    } else if (token.type === 'code') {
      const code = token as Tokens.Code & { rendered: string };
      if (/^(mermaid|pele)(?:\s|$)/i.test(code.lang ?? '')) {
        try { code.rendered = protect(renderPele(code.text, `${prefix}${fragments.size}`)); }
        catch { code.rendered = renderSourceError('图表暂时无法渲染', code.text); }
      } else code.rendered = protect(await renderCode(code.text, code.lang));
    }
  }

  const headingCounts = new Map<string, number>();
  const headingDepths = tokens.filter((token): token is Tokens.Heading => token.type === 'heading').map((token) => token.depth);
  const baseDepth = headingDepths.length ? Math.min(...headingDepths) : 1;
  const sections: ArticleSection[] = [];
  let heading: ArticleSection['heading'];
  let current: Token[] = [];
  const flush = () => {
    if (!heading && !current.length) return;
    // Reuse tokens and their resolved reference links, rather than reparsing
    // each section independently and losing definitions in another section.
    sections.push({ heading, html: clean(md.parser(current as TokensList)) });
    current = [];
  };
  for (const token of tokens) {
    if (token.type !== 'heading') { current.push(token); continue; }
    flush();
    const title = token as Tokens.Heading;
    const inlineHtml = md.Parser.parseInline(title.tokens, md.defaults);
    const text = stripHtml(inlineHtml.replace(new RegExp(`${prefix}\\d+_END`, 'g'), (key) => escapeHtml(fragmentText.get(key) ?? '')));
    const base = slugifyHeading(text);
    const count = (headingCounts.get(base) ?? 0) + 1;
    headingCounts.set(base, count);
    heading = { id: `article-${base}-${count}`, level: Math.min(6, title.depth - baseDepth + 1), text, html: clean(inlineHtml) };
  }
  flush();

  const plain = new Marked({ gfm: true });
  const searchText = stripHtml(plain.parse(markdown, { async: false }) as string).replace(/\s+/g, ' ').trim();
  const cjkCount = (searchText.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu) ?? []).length;
  const latinCount = (searchText.match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g) ?? []).length;
  return { sections, searchText, wordCount: cjkCount + latinCount, readingTime: Math.max(1, Math.ceil(cjkCount / 300 + latinCount / 220)) };
}
