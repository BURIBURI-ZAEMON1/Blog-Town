// Build first. Exercises both rich-content adaptation and the actual static RSS.
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { parseDocument, DomUtils } from 'htmlparser2';
import sharp from 'sharp';
registerHooks({ resolve(specifier, context, nextResolve) {
  try { return nextResolve(specifier, context); }
  catch (error) {
    if (specifier.startsWith('.') && context.parentURL?.includes('/src/lib/')) return nextResolve(`${specifier}.ts`, context);
    throw error;
  }
} });
const { renderArticleMarkdown } = await import('../src/lib/markdown.ts');
const { createMarkdownResources } = await import('../src/lib/markdown-embeds.ts');
const { createRssContentRenderer } = await import('../src/lib/rss-content.ts');
const { siteConfig } = await import('../src/config/site.ts');
const site = siteConfig.siteUrl;
const articleUrl = new URL('/posts/rss-test/', site).href;
const articleResources = createMarkdownResources('public', [{ key: 'rss-target', title: '引用目标', href: '/posts/rss-target/', markdown: '## 引用章节\n\n可嵌入的文字 ^rss-block' }]);
const resources = { resolveEmbed(reference, owner) {
  const media = { 'rss-video': ['test.mp4', 'mp4'], 'rss-audio': ['test.mp3', 'mp3'], 'rss-pdf': ['test.pdf', 'pdf'] }[reference];
  return media ? { kind: 'file', url: `/assets/${media[0]}`, name: media[0], extension: media[1] } : articleResources.resolveEmbed(reference, owner);
} };
const source = readFileSync('scripts/fixtures/markdown.md', 'utf8') + `
\n## 引用与嵌入
[[rss-target#引用章节]] 与 [[rss-target#^rss-block|块引用]]

![[rss-target#引用章节]]

![[rss-target#^rss-block]]

![[rss-target]]

![[rss-video]]

![[rss-audio]]

![[rss-pdf]]

\`\`\`markdown
> [!red] 不应渲染的提示框
## 不应渲染的标题
\`\`\`
`;
const article = await renderArticleMarkdown(source, { resources });
const renderer = createRssContentRenderer(site);
const html = await renderer.renderSections(article.sections, articleUrl);
assert.match(html, /引言第一行<br\s*\/?>单换行后的第二行/);
assert.match(html, /<del>删除线<\/del>/);
assert.match(html, /<mark style="background:#f3e6ac;color:#514019">重点高亮<\/mark>/);
assert.match(html, /☐ /); assert.match(html, /☑ /);
assert.match(html, /<blockquote[^>]*background:#ecf3f8/);
assert.match(html, /内层默认收起/); assert.match(html, /默认收起的内容/);
assert.match(html, /<p style="font-size:12px">Python<\/p><pre/);
assert.match(html, /<span style="color:#[\da-f]{6}">/i);
assert.match(html, /href="https?:\/\/[^" ]+\/posts\/rss-target\/#article-/);
assert.match(html, /href="https?:\/\/[^" ]+\/posts\/rss-target\/#block-rss-block/);
assert.match(html, /可嵌入的文字/);
assert.match(html, /&gt; \[!red\] 不应渲染的提示框/);
assert.match(html, /## 不应渲染的标题/);
assert.match(html, /href="https?:[^" ]+\/assets\/test\.mp4"/); assert.match(html, /href="https?:[^" ]+\/assets\/test\.mp3"/); assert.match(html, /href="https?:[^" ]+\/assets\/test\.pdf"/);
assert.doesNotMatch(html, /<(?:script|style|svg|mjx-container|details|summary|input|video|audio|object|iframe)\b/);
assert.doesNotMatch(html, /(?:href|src)="(?:\/|#)|--shiki-|var\(|javascript:|data-embed-key/);
assert.doesNotMatch(html, /查看原文公式|查看原文图表/, 'fixture unexpectedly fell back instead of rasterizing');
assert.equal(renderer.images.size, 8, 'all MathJax expressions and both diagram types should be static PNGs');
const equation = DomUtils.findOne(element => element.name === 'img' && element.attribs.alt === 'E = mc^2', parseDocument(html).children, true);
assert(equation && Number(equation.attribs.width) > 40, 'multi-SVG inline equations must retain the entire expression, not just the first glyph');
for (const { hash, png } of renderer.images.values()) {
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  const { width, height } = await sharp(png).metadata();
  assert(width > 0 && height > 0);
  const { channels } = await sharp(png).stats();
  assert(channels.some(channel => channel.min < 220 && channel.max > 240), 'image should contain visible content, not a blank frame');
  assert.match(html, new RegExp(`/rss-assets/${hash}\\.png`));
}
// Random renderer IDs must not churn content-addressed images across builds.
const repeat = createRssContentRenderer(site);
await repeat.renderSections((await renderArticleMarkdown(source, { resources })).sections, articleUrl);
assert.deepEqual([...repeat.images.keys()].sort(), [...renderer.images.keys()].sort());
const malicious = await renderer.renderSections([{ html: '<script>bad()</script><img src="javascript:alert(1)" onerror="bad()"><a href="data:text/html,bad">bad</a><div style="background:url(https://bad.test);position:fixed">safe text</div>' }], articleUrl);
assert.doesNotMatch(malicious, /javascript:|data:text|onerror|bad\(\)|position:|url\(/);

const xml = readFileSync('dist/rss.xml', 'utf8');
const feed = parseDocument(xml, { xmlMode: true });
const find = (node, name) => DomUtils.findAll(element => element.name === name, node.children ?? []);
const items = find(feed, 'item');
const postDirectories = readdirSync('dist/posts', { withFileTypes: true }).filter(entry => entry.isDirectory());
assert.equal(items.length, postDirectories.length, 'feed must contain exactly the published article routes');
assert.equal(find(feed, 'atom:link')[0].attribs.href, new URL('/rss.xml', site).href);
const links = [];
let lastDate = Infinity;
for (const item of items) {
  const link = DomUtils.textContent(find(item, 'link')[0]);
  assert.equal(new URL(link).origin, new URL(site).origin);
  assert(existsSync(`dist${decodeURI(new URL(link).pathname)}index.html`));
  links.push(link);
  assert.equal(DomUtils.textContent(find(item, 'guid')[0]), link, 'stable permalink GUID');
  const date = Date.parse(DomUtils.textContent(find(item, 'pubDate')[0]));
  assert(date <= Date.now() && date <= lastDate); lastDate = date;
  const body = DomUtils.textContent(find(item, 'content:encoded')[0]);
  assert(body.length > 40); assert.match(body, /在网站中阅读原文/);
  assert.doesNotMatch(body, /<svg\b|<script\b|<details\b|(?:src|href)="(?:\/|#)/);
  const doc = parseDocument(body);
  for (const img of DomUtils.findAll(element => element.name === 'img', doc.children)) {
    const url = new URL(img.attribs.src);
    if (url.pathname.startsWith('/rss-assets/')) assert(existsSync(`dist${url.pathname}`), `missing feed image ${url.pathname}`);
  }
}
assert.equal(new Set(links).size, links.length);
assert.match(readFileSync('dist/index.html', 'utf8'), /rel="alternate" type="application\/rss\+xml"/);
console.log(`RSS verification passed: ${items.length} published articles; links, embeds, static callouts/tasks, syntax colors, 8 rich-content PNGs, safety, and deterministic image hashes.`);
