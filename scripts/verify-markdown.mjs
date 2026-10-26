import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { registerHooks } from 'node:module';

// Resolve the source's extensionless imports while using Node's native TS
// stripping. ESM avoids loading separate CJS/ESM MathJax font registries.
registerHooks({ resolve(specifier, context, nextResolve) {
  try { return nextResolve(specifier, context); }
  catch (error) {
    if (specifier.startsWith('.') && context.parentURL?.includes('/src/lib/')) return nextResolve(`${specifier}.ts`, context);
    throw error;
  }
} });
const { renderArticleMarkdown } = await import('../src/lib/markdown.ts');
const source = readFileSync('scripts/fixtures/markdown.md', 'utf8');
const article = await renderArticleMarkdown(source);
const html = article.sections.map((section) => section.html).join('\n');
assert.match(html, /引言第一行<br\s*\/?>\s*单换行后的第二行/);
assert.match(html, /<del>删除线<\/del>/);
assert.match(html, /<mark>重点高亮<\/mark>/);
assert.match(html, /<code>==代码不高亮==<\/code>/);
assert.equal((html.match(/type="checkbox"/g) ?? []).length, 3);
assert.match(html, /type="checkbox"[^>]*disabled/);
assert.match(html, /checked/);
assert.match(html, /href="https:\/\/example.com\/guide"/);
assert.match(html, /rel="noreferrer noopener"/);
assert.match(html, /class="external-link-icon"/);
assert.match(html, /<a href="#article-数学与图表-1">本页章节<\/a>/);
assert.match(html, /<aside class="article-callout callout-blue">/);
assert.match(html, /<details class="article-callout callout-red" open>/);
assert.match(html, /<details class="article-callout callout-purple"><summary/);
for (const color of ['red', 'blue', 'yellow', 'green', 'purple', 'gray']) assert.match(html, new RegExp(`callout-${color}`));
assert.equal((html.match(/class="shiki/g) ?? []).length, 3);
assert.match(html, /data-language="TypeScript"/);
assert.match(html, /data-language="Python"/);
assert.match(html, /--shiki-light:/);
assert.match(html, /--shiki-dark:/);
assert.match(html, /role="math"/);
assert.match(html, /class="article-math is-display"/);
assert.match(html, /data-mml-node="mfrac"/);
assert.equal((html.match(/class="article-diagram"/g) ?? []).length, 2);
assert.doesNotMatch(html, /article-render-error/);
const mathHeading = article.sections.find((section) => section.heading?.text.includes('高亮'));
assert.match(mathHeading.heading.html, /<mark>高亮<\/mark>/);
assert.match(mathHeading.heading.html, /role="math"/);
assert.deepEqual(article.sections.map((section) => section.heading?.level), [undefined, 1, 2, 3, 2]);
assert(article.wordCount > 100 && article.readingTime >= 1);

const bad = await renderArticleMarkdown(`
<script>alert('bad')</script><img src="javascript:bad" onerror="alert(1)">
<a href="javascript:alert(1)">不安全链接</a>
<svg onload="alert(1)"><script>alert(1)</script></svg>
<iframe src="https://example.com"></iframe>
<object data="/untrusted.html" type="text/html"></object>
<input type="text" onfocus="alert(1)">

\`\`\`html
<script>literal</script>
\`\`\`

> [!red] <img src="x" onerror="alert(1)">
> <script>bad</script>

$\\href{javascript:alert(1)}{unsafe}$

\`\`\`mermaid
flowchart LR
 A[<script>alert</script>] --> B[End]
 click A "javascript:alert(1)"
\`\`\`
`);
const unsafe = bad.sections.map((section) => section.html).join('');
assert.doesNotMatch(unsafe, /<script|<iframe|<object|onerror=|onload=|onfocus=|href="javascript:/i);
assert.match(unsafe, /&(?:lt|#x3C);/);
const malformed = await renderArticleMarkdown('```mermaid\nnot a diagram\n```\n\n$\\frac{$');
assert.match(malformed.sections[0].html, /图表暂时无法渲染/);
assert.match(malformed.sections[0].html, /公式语法有误/);
const alt = await renderArticleMarkdown('![A $x$ ==highlight== &amp; B](https://example.com/image.png)');
assert.doesNotMatch(alt.sections[0].html, /article-math|<mark>|BLOG_RENDER_/);
assert.match(alt.sections[0].html, /alt="A \$x\$ ==highlight== &amp; B"/);
const symbols = await renderArticleMarkdown('# A &amp; B ~~old~~ ==new== $x^2$');
assert.equal(symbols.sections[0].heading.text, 'A & B old new x^2');
const references = await renderArticleMarkdown('> [!blue] [文档][ref]\n> 正文中的 [链接][ref]\n\n# 章节\n\n[ref]: https://example.com/reference');
assert.equal((references.sections[0].html.match(/href="https:\/\/example.com\/reference"/g) ?? []).length, 2);
const literal = await renderArticleMarkdown('\\$not math\\$\n\n```text\n> [!red] not a callout\n==not a highlight==\n```');
assert.doesNotMatch(literal.sections[0].html, /article-callout|article-math|<mark>/);
const { createMarkdownResources } = await import('../src/lib/markdown-embeds.ts');
const publicDir = mkdtempSync(join(tmpdir(), 'town-markdown-'));
try {
  mkdirSync(join(publicDir, 'assets/文章 A'), { recursive: true });
  mkdirSync(join(publicDir, 'assets/文章 B'), { recursive: true });
  for (const path of ['assets/文章 A/图 片.png', 'assets/文章 A/cover.png', 'assets/文章 B/cover.png', 'voice.mp3', 'clip.mp4', 'report.pdf', 'archive.zip']) writeFileSync(join(publicDir, path), 'fixture');
  symlinkSync('/etc/passwd', join(publicDir, 'private.txt'));
  const resources = createMarkdownResources(publicDir, [
    { key: 'folder/a', title: '文章甲', href: '/posts/a/', assetDirectory: '/assets/文章 A', markdown: '# 甲标题\n\n甲正文\n\n![[b]]' },
    { key: 'folder/b', title: '文章乙', href: '/posts/b/', markdown: '乙正文\n\n![[a]]' },
  ]);
  assert.equal(resources.resolveEmbed('cover.png', 'folder/a').kind, 'file');
  assert.equal(resources.resolveEmbed('cover.png').kind, 'missing');
  assert.equal(resources.resolveEmbed('private.txt').kind, 'missing');
  assert.equal(resources.resolveEmbed('javascript:alert(1)').kind, 'missing');
  assert.equal(resources.resolveEmbed('../secret.png').kind, 'missing');
  assert.equal(resources.resolveEmbed('/%2e%2e/secret.png').kind, 'missing');
  assert.equal(resources.resolveEmbed('unpublished.md').kind, 'missing');
  assert.equal(resources.resolveEmbed('folder/a#heading').kind, 'missing');
  const embeds = await renderArticleMarkdown([
    '![[assets/文章 A/图 片.png|240x120]]', '![[voice.mp3]]', '![[clip.mp4]]', '![[report.pdf#page=2]]', '![[archive.zip]]', '![[folder/a]]',
    '内联 ![[assets/文章 A/图 片.png|替代文本]] 内容', '![[https://example.com/image.png|远程图片]]',
  ].join('\n\n'), { resources });
  const embedded = embeds.sections.map((section) => section.html).join('');
  assert.match(embedded, /width="240" height="120"/);
  assert.match(embedded, /%E5%9B%BE%20%E7%89%87\.png/);
  assert.match(embedded, /alt="替代文本"/);
  assert.match(embedded, /<audio[^>]*controls/);
  assert.match(embedded, /<video[^>]*controls/);
  assert.match(embedded, /<object[^>]*data="\/report.pdf#page=2"/);
  assert.match(embedded, /href="\/archive.zip"/);
  assert.match(embedded, /class="article-embed-note" data-embed-key="[^"]+" role="group"/);
  assert.match(embedded, /class="embed-note-summary" role="button"[^>]*aria-expanded="true"/);
assert.match(embedded, /class="embed-note-source"/);
assert.doesNotMatch(embedded, /<details class="article-embed/);
  assert.match(embedded, /class="article-embed article-file-embed" data-embed-key="[^"]+" role="group"/);
  assert.match(embedded, /甲正文/);
  assert.match(embedded, /乙正文/);
  assert.match(embedded, /已停止重复或过深的嵌入/);
  assert.match(embedded, /src="https:\/\/example.com\/image.png"/);
  assert.doesNotMatch(embedded, /<p><(?:figure|div|details)/);
const articleLinks = await renderArticleMarkdown('[[folder/a]] and [[folder/b|the other note]] and ![[assets/文章 A/图 片.png]]', { resources });
const articleLinkHtml = articleLinks.sections.map((section) => section.html).join('');
assert.match(articleLinkHtml, /class="article-wikilink" href="\/posts\/a\/">文章甲/);
assert.match(articleLinkHtml, /class="article-wikilink" href="\/posts\/b\/">the other note/);
assert.doesNotMatch(articleLinkHtml, /article-wikilink[^>]*href="[^"]*图/);
assert.match(articleLinkHtml, /class="article-embed-image"/);
} finally { rmSync(publicDir, { recursive: true, force: true }); }
console.log('Markdown verification passed: line breaks, GFM, callouts, highlighting, MathJax, Pele, references, and HTML safety.');
