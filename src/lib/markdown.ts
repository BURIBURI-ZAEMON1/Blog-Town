import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { Marked, type Token, type Tokens, type TokensList } from 'marked';
import { parseMarkdownSource, findContentTarget, type AnchoredToken } from './markdown-source';
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
  target?: string;
  anchorPrefix?: string;
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
  const source = parseMarkdownSource(markdown);
  const { md } = source;
  const tokens = (options.target ? findContentTarget(source, options.target)?.tokens ?? [] : source.tokens) as TokensList;
  tokens.links = source.tokens.links;
  md.use({
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
  let renderMath: ReturnType<typeof createMathRenderer> | undefined;
  // Keep source order for TeX macros, and keep highlighting out of the client.
  const richTokens: Token[] = [];
  md.walkTokens(tokens, (token) => { richTokens.push(token); });
  for (const token of richTokens) {
    if (token.type === 'contentReference') {
      const [reference, ...labels] = (token.source as string).split('|');
      const label = labels.join('|').trim();
      const resources = options.resources ??= createMarkdownResources(resolve('public'));
      const resource = resources.resolveEmbed(reference, options.documentKey);
      if (resource.kind === 'document') {
        const href = resource.document.href + (resource.target ? `#${encodeURIComponent(resource.target.id)}` : '');
        const text = resource.document.title + (resource.target ? ` › ${resource.target.label}` : '');
        token.rendered = `<a class="article-content-ref" href="${escapeHtml(href)}">${escapeHtml(label || text)}</a>`;
      } else if (resource.kind === 'file') {
        token.rendered = `<a class="article-content-ref article-content-ref-file" href="${escapeHtml(resource.url)}">${escapeHtml(label || resource.name)}</a>`;
      } else {
        token.rendered = `<span class="article-content-ref-missing" title="${escapeHtml(resource.message)}">[[${escapeHtml(token.source as string)}]]</span>`;
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
        token.rendered = protect(renderFileEmbed(resource, label, inline, `${options.anchorPrefix ?? ''}${options.documentKey ?? 'article'}-embed-${embedNumber++}`), label || resource.name);
      } else {
        const note = resource.document;
        const stack = options.embedStack ?? (options.documentKey ? [options.documentKey] : []);
        const target = resource.target;
        const referenceKey = note.key + (target ? `#${target.id}` : '');
        const title = note.title + (target ? ` › ${target.label}` : '');
        const href = note.href + (target ? `#${encodeURIComponent(target.id)}` : '');
        const link = `<a href="${escapeHtml(href)}">${escapeHtml(label || title)}</a>`;
        if (inline || stack.includes(referenceKey) || stack.length >= 4) {
          token.rendered = `<span class="article-embed-reference">${link}${inline ? '' : '（已停止重复或过深的嵌入）'}</span>`;
        } else {
          const embedKey = `${options.anchorPrefix ?? ''}${options.documentKey ?? 'article'}-embed-${embedNumber++}`;
          const embedded = await renderArticleMarkdown(note.markdown, { resources, documentKey: note.key, target: target?.fragment, embedStack: [...stack, referenceKey], anchorPrefix: `embed-${embedKey}-` });
          const contents = embedded.sections.map((section) => `${section.heading ? `<h${Math.min(6, section.heading.level + 2)} id="${escapeHtml(section.heading.id)}">${section.heading.html}</h${Math.min(6, section.heading.level + 2)}>` : ''}${section.html}`).join('');
          token.rendered = protect(`<div class="article-embed-note" data-embed-key="${escapeHtml(embedKey)}" role="group"><div class="embed-note-summary" role="button" tabindex="0" aria-expanded="true"><span>${target ? target.kind === 'heading' ? '引用章节' : '引用片段' : '嵌入文章'} · </span><span class="embed-note-title">${escapeHtml(label || title)}</span><span class="embed-note-toggle" aria-hidden="true"></span></div><div class="article-embed-body"><div class="embed-note-source">${link}</div>${contents}</div></div>`, title);
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

  const headingByToken = new Map(source.headings.map((heading) => [heading.token, heading]));
  const anchor = (id: string) => protect(`<span class="article-reference-anchor" id="${escapeHtml(`${options.anchorPrefix ?? ''}${id}`)}"></span>`);
  const insertAnchors = (items: Token[]) => {
    for (let i = 0; i < items.length; i++) {
      const token = items[i];
      for (const id of (token as AnchoredToken).blockAnchors ?? []) items.splice(i++, 0, { type: 'referenceAnchor', raw: '', id });
      if (token.type === 'list') {
        for (const item of (token as Tokens.List).items) insertAnchors(item.tokens);
      } else if ((token.type === 'blockquote' || token.type === 'callout') && Array.isArray(token.tokens)) {
        insertAnchors(token.tokens);
      }
    }
  };
  insertAnchors(tokens);
  md.use({
    renderer: { heading(token) {
      const indexed = headingByToken.get(token)!;
      return `<h${token.depth}>${anchor(indexed.id)}${this.parser.parseInline(token.tokens)}</h${token.depth}>`;
    } },
    extensions: [{ name: 'referenceAnchor', renderer(token) { return anchor(token.id); } }],
  });

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
    const indexed = headingByToken.get(title)!;
    heading = { id: `${options.anchorPrefix ?? ''}${indexed.id}`, level: Math.min(6, title.depth - baseDepth + 1), text, html: clean(inlineHtml) };
  }
  flush();

  const plain = new Marked({ gfm: true });
  const searchText = stripHtml(plain.parse(markdown, { async: false }) as string).replace(/\s+/g, ' ').trim();
  const cjkCount = (searchText.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu) ?? []).length;
  const latinCount = (searchText.match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g) ?? []).length;
  return { sections, searchText, wordCount: cjkCount + latinCount, readingTime: Math.max(1, Math.ceil(cjkCount / 300 + latinCount / 220)) };
}
