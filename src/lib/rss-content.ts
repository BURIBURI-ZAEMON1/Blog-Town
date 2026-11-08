// RSS-only, build-time adaptation. Keep the site's richer HTML and client bundle unchanged.
import { createHash } from 'node:crypto';
import { parseDocument, DomUtils } from 'htmlparser2';
import sanitizeHtml from 'sanitize-html';
import serialize from 'dom-serializer';
import sharp from 'sharp';
import type { ArticleSection } from './markdown';

const escape = (text: string) => text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]!));
type FeedNode = ReturnType<typeof parseDocument>['children'][number];
type FeedElement = Extract<FeedNode, { attribs: Record<string, string> }>;
const isElement = (node: FeedNode): node is FeedElement => 'attribs' in node;
const hasClass = (node: FeedElement, name: string) => (node.attribs.class ?? '').split(/\s+/).includes(name);
const replace = (node: FeedElement, html: string) => DomUtils.replaceElement(node, parseDocument(html).children[0]);

const callouts: Record<string, [string, string]> = {
  blue: ['#356283', '#ecf3f8'], red: ['#943d3e', '#faeeee'], yellow: ['#806014', '#faf4df'],
  green: ['#356b4c', '#edf5ed'], purple: ['#70518f', '#f4eff9'], gray: ['#5b6263', '#f0f1ef'],
};

// MathJax 4 can split one inline formula into several sibling SVGs at
// optional line-break positions. Rasterize the entire expression, not just its
// first SVG (which would silently turn E=mc² into E).
function mathSvg(node: FeedElement) {
  const container = DomUtils.findOne(child => child.name === 'mjx-container', node.children, true);
  const pieces = container?.children.filter((child): child is FeedElement => isElement(child) && child.name === 'svg') ?? [];
  if (pieces.length < 2) return DomUtils.findOne(child => child.name === 'svg', node.children, true);
  const boxes = pieces.map(piece => (piece.attribs.viewBox ?? '').split(/[\s,]+/).map(Number));
  const scale = parseFloat(pieces[0].attribs.width) * (/ex$/.test(pieces[0].attribs.width) ? 8 : 1) / boxes[0][2];
  const top = Math.min(...boxes.map(box => box[1]));
  const bottom = Math.max(...boxes.map(box => box[1] + box[3]));
  const spaces = [1, 111, 167, 222, 278, 333];
  let width = 0;
  const groups = pieces.map((piece, index) => {
    const previous = piece.prev;
    if (previous && isElement(previous) && previous.name === 'mjx-break') width += spaces[Number(previous.attribs.size)] ?? 0;
    const group = `<g transform="translate(${width - boxes[index][0]},0)">${serialize(piece.children, { xmlMode: true })}</g>`;
    width += boxes[index][2];
    return group;
  }).join('');
  return parseDocument(`<svg xmlns="http://www.w3.org/2000/svg" width="${width * scale}px" height="${(bottom - top) * scale}px" viewBox="0 ${top} ${width} ${bottom - top}">${groups}</svg>`, { lowerCaseAttributeNames: false }).children[0] as FeedElement;
}

export interface RssImage { hash: string; png: Buffer }

export function createRssContentRenderer(siteUrl: string) {
  const images = new Map<string, RssImage>();
  const absolute = (path: string, articleUrl: string) => {
    try {
      const url = new URL(path, articleUrl);
      return ['https:', 'http:', 'mailto:', 'tel:'].includes(url.protocol) ? url.href : undefined;
    } catch { return undefined; }
  };

  async function renderSections(sections: ArticleSection[], articleUrl: string) {
    const html = sections.map(({ heading, html }) => {
      const tag = heading ? `h${Math.min(6, heading.level + 1)}` : '';
      return `${heading ? `<${tag} id="${escape(heading.id)}">${heading.html ?? escape(heading.text)}</${tag}>` : ''}${html}`;
    }).join('\n');
    const document = parseDocument(html, { lowerCaseAttributeNames: false, lowerCaseTags: false, recognizeSelfClosing: true });
    async function adapt(node: FeedNode): Promise<void> {
      if (!isElement(node)) return;
      const math = hasClass(node, 'article-math');
      const diagram = hasClass(node, 'article-diagram');
      if (math || diagram) {
        const svg = math ? mathSvg(node) : DomUtils.findOne(child => child.name === 'svg', node.children, true);
        const labels = diagram && svg ? DomUtils.findAll(child => child.name === 'text', svg.children).map(DomUtils.textContent).filter(Boolean) : [];
        const alt = math ? node.attribs['aria-label'] ?? '数学公式' : `文章图表${labels.length ? `：${[...new Set(labels)].join('、')}` : ''}`;
        if (svg) {
          try {
            // MathJax uses ex units, Pele uses a responsive viewBox. Give librsvg
            // explicit physical dimensions, and rasterize at 2x for sharp reader output.
            const box = (svg.attribs.viewBox ?? svg.attribs.viewbox ?? '').split(/[\s,]+/).map(Number);
            const length = (value = '') => parseFloat(value) * (/ex$/.test(value) ? 8 : 1);
            const naturalWidth = math ? length(svg.attribs.width) : box[2];
            const width = Math.min(1000, Math.max(1, naturalWidth));
            const height = Math.max(1, math ? length(svg.attribs.height) * width / naturalWidth : width * box[3] / box[2]);
            if (![width, height].every(Number.isFinite) || height > 6000) throw new Error('Invalid SVG dimensions');
            svg.attribs.width = `${width}px`;
            svg.attribs.height = `${height}px`;
            svg.attribs.xmlns = 'http://www.w3.org/2000/svg';
            // SVG's default currentColor is not consistent across rasterizers.
            svg.attribs.color = '#17202b';
            // Pele uses CSS custom properties, unsupported by some SVG rasterizers.
            // Resolve its self-contained default palette before handing it to librsvg.
            const variables = Object.fromEntries([...((svg.attribs.style ?? '').matchAll(/(--[\w-]+):([^;]+)/g))].map(([, key, value]) => [key, value]));
            const resolveVariables = (input: string): string => {
              for (let i = 0; i < 12 && input.includes('var('); i++) {
                const next = input.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*))?\)/g, (_, key: string, fallback: string) => variables[key] ?? fallback ?? 'inherit');
                if (next === input) break;
                input = next;
              }
              return input;
            };
            for (const element of [svg, ...DomUtils.findAll(() => true, svg.children)]) {
              for (const [attribute, value] of Object.entries(element.attribs)) {
                if (!/^(?:data-|aria-)/.test(attribute) && value.includes('var(')) element.attribs[attribute] = resolveVariables(value);
              }
            }
            const svgSource = serialize(svg, { xmlMode: true });
            const png = await sharp(Buffer.from(svgSource), { density: 144, limitInputPixels: 30_000_000 })
              .flatten({ background: '#ffffff' }).png().toBuffer();
            const hash = createHash('sha256').update(png).digest('hex').slice(0, 24);
            images.set(hash, { hash, png });
            const src = new URL(`/rss-assets/${hash}.png`, siteUrl).href;
            const image = `<img src="${escape(src)}" alt="${escape(alt)}" width="${Math.ceil(width)}" height="${Math.ceil(height)}" style="max-width:100%;height:auto;vertical-align:middle">`;
            replace(node, math && !hasClass(node, 'is-display') ? image : `<figure>${image}</figure>`);
          } catch (error) {
            console.warn(`[RSS] Image fallback for ${articleUrl}:`, error);
            replace(node, `<p>${math ? `<code>${escape(alt)}</code> · ` : ''}<a href="${escape(articleUrl)}">${math ? '查看原文公式' : '查看原文图表'}</a></p>`);
          }
        } else replace(node, `<p><a href="${escape(articleUrl)}">${escape(alt)}</a></p>`);
        return;
      }
      if (['audio', 'video', 'object', 'iframe'].includes(node.name)) {
        const path = node.attribs.src ?? node.attribs.data;
        const url = path && absolute(path, articleUrl);
        replace(node, `<p><a href="${escape(url || articleUrl)}">${escape(node.attribs['aria-label'] ?? (node.name === 'audio' ? '收听音频' : node.name === 'video' ? '观看视频' : '打开嵌入文件'))}</a></p>`);
        return;
      }
      if (node.name === 'input') {
        replace(node, `<span>${Object.hasOwn(node.attribs, 'checked') ? '☑' : '☐'} </span>`);
        return;
      }
      if (node.name === 'details') node.name = 'div'; // Never lose collapsed contents in feed readers.
      if (node.name === 'summary' || hasClass(node, 'embed-note-summary') || hasClass(node, 'embed-file-summary')) {
        node.name = 'p';
        node.attribs.style = 'font-weight:600;margin:0 0 8px';
      }
      if (hasClass(node, 'article-callout')) {
        node.name = 'blockquote';
        const color = Object.keys(callouts).find(color => hasClass(node, `callout-${color}`)) ?? 'blue';
        const [ink, background] = callouts[color];
        node.attribs.style = `padding:14px 18px;margin:20px 0;border-radius:9px;background:${background};color:${ink}`;
      }
      if (hasClass(node, 'callout-title')) node.attribs.style = 'font-weight:600;margin:0 0 8px';
      if (hasClass(node, 'article-embed-note') || hasClass(node, 'article-file-embed')) {
        node.name = 'blockquote';
        node.attribs.style = 'margin:20px 0;padding:14px 18px;border:1px solid #d5d9d2;border-radius:9px';
      }
      if (node.name === 'pre') {
        const language = node.attribs['data-language'];
        if (language) DomUtils.prepend(node, parseDocument(`<p style="font-size:12px">${escape(language)}</p>`).children[0]);
        node.attribs.style = 'padding:16px;background:#f6f8fa;color:#24292f;border-radius:9px;white-space:pre-wrap;overflow-wrap:anywhere';
      }
      // Shiki's dual-theme custom properties need the website CSS. Retain a
      // standalone light palette instead, with its background fixed above.
      if (node.attribs.style?.includes('--shiki-light:')) {
        const color = /(?:^|;)--shiki-light:([^;]+)/.exec(node.attribs.style)?.[1];
        node.attribs.style = color ? `color:${color}` : '';
      }
      if (node.name === 'mark') node.attribs.style = 'background:#f3e6ac;color:#514019';
      for (const attribute of ['href', 'src']) {
        if (node.attribs[attribute]) {
          const url = absolute(node.attribs[attribute], articleUrl);
          if (url) node.attribs[attribute] = url;
          else delete node.attribs[attribute];
        }
      }
      if (node.name === 'img') node.attribs.style = 'max-width:100%;height:auto';
      for (const child of [...node.children]) await adapt(child);
    }
    for (const node of [...document.children]) await adapt(node);
    return sanitizeHtml(serialize(document), {
      allowedTags: [...sanitizeHtml.defaults.allowedTags, 'img', 'figure', 'figcaption', 'mark', 'del'],
      allowedAttributes: {
        '*': ['id', 'style'], a: ['href', 'title'], img: ['src', 'alt', 'width', 'height'],
        th: ['colspan', 'rowspan', 'align'], td: ['colspan', 'rowspan', 'align'],
      },
      allowedSchemes: ['http', 'https', 'mailto', 'tel'],
      allowedSchemesByTag: { img: ['http', 'https'] },
      allowProtocolRelative: false,
      allowedStyles: {
        '*': {
          color: [/^#[\da-f]{3,8}$/i], background: [/^#[\da-f]{3,8}$/i],
          'font-weight': [/^[1-9]00$/], 'font-size': [/^\d+px$/],
          padding: [/^[\d px]+$/], margin: [/^[\d px]+$/], 'border-radius': [/^\d+px$/], border: [/^1px solid #[\da-f]{6}$/i],
          'max-width': [/^100%$/], height: [/^auto$/], 'vertical-align': [/^middle$/],
          'white-space': [/^pre-wrap$/], 'overflow-wrap': [/^anywhere$/],
        },
      },
    });
  }
  return { renderSections, images };
}
