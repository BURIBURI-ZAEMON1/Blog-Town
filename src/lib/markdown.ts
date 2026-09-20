import { marked, type Tokens } from 'marked';
import sanitizeHtml from 'sanitize-html';

export interface ArticleSection {
  heading?: {
    id: string;
    level: number;
    text: string;
  };
  html: string;
}

export interface RenderedArticle {
  sections: ArticleSection[];
  searchText: string;
  wordCount: number;
  readingTime: number;
}

const slugifyHeading = (text: string) => text
  .toLowerCase()
  .trim()
  .replace(/[^\p{Letter}\p{Number}\u4e00-\u9fff]+/gu, '-')
  .replace(/^-+|-+$/g, '') || 'section';

const plainHeadingText = (token: Tokens.Heading) => token.text
  .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
  .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  .replace(/<[^>]+>/g, '')
  .replace(/[`*_~]/g, '')
  .trim();

const sanitizeArticleHtml = (html: string) => sanitizeHtml(html, {
  allowedTags: [
    ...sanitizeHtml.defaults.allowedTags,
    'img', 'figure', 'figcaption', 'details', 'summary', 'kbd', 'mark',
  ],
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    a: ['href', 'title', 'target', 'rel', 'download'],
    img: ['src', 'alt', 'title', 'width', 'height', 'loading', 'decoding'],
    code: ['class'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: { img: ['http', 'https'] },
  allowProtocolRelative: false,
  transformTags: {
    a: (_tagName, attributes) => {
      const external = /^https?:\/\//i.test(attributes.href ?? '');
      return {
        tagName: 'a',
        attribs: external
          ? { ...attributes, target: '_blank', rel: 'noreferrer noopener' }
          : attributes,
      };
    },
    img: (_tagName, attributes) => ({
      tagName: 'img',
      attribs: { ...attributes, loading: 'lazy', decoding: 'async' },
    }),
  },
});

const markdownToPlainText = (markdown: string) => sanitizeHtml(
  marked.parse(markdown, { async: false, gfm: true }) as string,
  { allowedTags: [], allowedAttributes: {} },
).replace(/\s+/g, ' ').trim();

export const renderArticleMarkdown = (markdown: string): RenderedArticle => {
  const tokens = marked.lexer(markdown, { gfm: true });
  const headingCounts = new Map<string, number>();
  const headingDepths = tokens.filter((token): token is Tokens.Heading => token.type === 'heading').map((token) => token.depth);
  const baseHeadingDepth = headingDepths.length ? Math.min(...headingDepths) : 1;
  const sections: ArticleSection[] = [];
  let currentHeading: ArticleSection['heading'];
  let currentMarkdown = '';

  const flush = () => {
    if (!currentHeading && !currentMarkdown.trim()) return;
    const rendered = marked.parse(currentMarkdown, { async: false, gfm: true }) as string;
    sections.push({ heading: currentHeading, html: sanitizeArticleHtml(rendered) });
    currentMarkdown = '';
  };

  for (const token of tokens) {
    if (token.type !== 'heading') {
      currentMarkdown += token.raw;
      continue;
    }
    flush();
    const headingToken = token as Tokens.Heading;
    const text = plainHeadingText(headingToken);
    const base = slugifyHeading(text);
    const count = (headingCounts.get(base) ?? 0) + 1;
    headingCounts.set(base, count);
    currentHeading = { id: `article-${base}-${count}`, level: Math.min(6, headingToken.depth - baseHeadingDepth + 1), text };
  }
  flush();

  const searchText = markdownToPlainText(markdown);
  const cjkCount = (searchText.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu) ?? []).length;
  const latinCount = (searchText.match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g) ?? []).length;
  const wordCount = cjkCount + latinCount;
  const readingTime = Math.max(1, Math.ceil((cjkCount / 300) + (latinCount / 220)));

  return { sections, searchText, wordCount, readingTime };
};
