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
// Markdown examples must stay literal, including inside nested containers.
const literalMarkdown = [
  '# 原样标题', '> [!blue] 原样提示框', '==原样高亮== $x^2$',
  '[[原样链接]]', '![[原样嵌入.md]]', '- [x] 原样任务', '<strong>原样 HTML</strong>',
].join('\n');
for (const language of ['', 'text', 'md', 'markdown', 'Markdown']) {
  const example = await renderArticleMarkdown(`\`\`\`${language}\n${literalMarkdown}\n\`\`\``);
  const exampleHtml = example.sections.map((section) => section.html).join('');
  assert.equal(example.sections.length, 1);
  assert.equal(example.sections[0].heading, undefined);
  assert.doesNotMatch(exampleHtml, /article-callout|article-math|article-embed|article-content-ref|<mark>|<input|<strong>|<h[1-6]/);
  // Shiki's outer theme variables remain; source tokens have no rich styling.
  assert.doesNotMatch(exampleHtml, /<span[^>]*style=/);
  const { decodeHTML } = await import('entities');
  assert.equal(decodeHTML(exampleHtml.replace(/<[^>]*>/g, '')), literalMarkdown);
}
const nestedLiteral = await renderArticleMarkdown(`> [!blue] 外层提示框\n>\n> \`\`\`md\n> ${literalMarkdown.replaceAll('\n', '\n> ')}\n> \`\`\``);
const nestedHtml = nestedLiteral.sections[0].html;
assert.equal((nestedHtml.match(/class="article-callout/g) ?? []).length, 1);
assert.doesNotMatch(nestedHtml, /<span[^>]*style=/);
// Every source line retains both quote prefixes; a third > is literal code.
const doubleCalloutCode = [
  '> [!blue]+ 备注', '> 外层说明', '> > [!purple]- 详细语法',
  '> > ```markdown', '> > > [!blue] 阅读提示', '> > > 支持 **粗体**、==高亮== 与 $x$。',
  '> > > > [!purple]- 示例中的内层提示框', '> > > > 内层内容', '> > ```',
].join('\n');
const doubleCallout = await renderArticleMarkdown(doubleCalloutCode);
const doubleHtml = doubleCallout.sections[0].html;
assert.equal((doubleHtml.match(/class="article-callout/g) ?? []).length, 2);
const doubleCode = doubleHtml.match(/<pre\b[^>]*>[\s\S]*?<\/pre>/)?.[0];
assert.ok(doubleCode, '双层提示框中的代码必须渲染为多行代码块');
const outsideCode = await renderArticleMarkdown('```markdown\n> [!blue] 阅读提示\n> 支持 **粗体**、==高亮== 与 $x$。\n> > [!purple]- 示例中的内层提示框\n> > 内层内容\n```');
assert.equal(doubleCode, outsideCode.sections[0].html);
const highlightedPython = await renderArticleMarkdown('```python\nprint("hello")\n```');
assert.match(highlightedPython.sections[0].html, /data-language="Python"/);
assert.match(highlightedPython.sections[0].html, /<span[^>]*style=/);
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
assert.match(articleLinkHtml, /class="article-content-ref" href="\/posts\/a\/">文章甲/);
assert.match(articleLinkHtml, /class="article-content-ref" href="\/posts\/b\/">the other note/);
assert.doesNotMatch(articleLinkHtml, /article-content-ref[^>]*href="[^"]*图/);
assert.match(articleLinkHtml, /class="article-embed-image"/);

  const referenceSource = [
    '# 开始', '', '开场内容', '',
    '## **引用章节**', '', '目标段落 **加粗** [参考][outside]。 ^intro', '',
    '### 子标题', '', '下级内容', '',
    '> [!blue]- 收起的提示', '> 提示内的目标段落。 ^inside', '',
    '- [x] 一个任务 ^task', '- 另一个列表项', '',
    '| 名称 | 值 |', '| --- | --- |', '| 表格内容 | 42 |', '', '^table', '',
    '```markdown', '> [!red] 原样提示', '# 代码内标题', '代码内段落 ^code-marker', '```', '', '^code', '',
    '> 引用的整个块', '', '^quote', '',
    '## 结束', '', '不要出现在章节嵌入中', '', '### 100% 完成', '', '末尾百分比内容', '',
    '## 别的父标题', '### 子标题', '', '同名标题的第二处', '',
    '[outside]: https://example.com/reference',
  ].join('\n');
  const refResources = createMarkdownResources(publicDir, [
    { key: 'reference', title: '引用示例', href: '/posts/reference/', markdown: referenceSource },
    { key: 'loop', title: '循环', href: '/posts/loop/', markdown: '# 自嵌入\n\n![[loop#自嵌入]]' },
    { key: 'duplicate', title: '重复块', href: '/posts/duplicate/', markdown: '甲 ^same\n\n乙 ^same' },
  ]);
  const renderRefs = (source, documentKey = 'reference') => renderArticleMarkdown(source, { resources: refResources, documentKey });
  const toHtml = (article) => article.sections.map((section) => section.html).join('');
  const referenced = await renderRefs(referenceSource);
  const refHtml = toHtml(referenced);
  assert.match(refHtml, /id="block-intro"/);
  assert.match(refHtml, /id="block-inside"/);
  assert.doesNotMatch(refHtml, /\^intro|\^inside|\^task|\^table|\^quote/);
  assert.match(refHtml, /代码内段落 \^code-marker/);
  assert.equal(refResources.resolveEmbed('reference#^code-marker').kind, 'missing');
  assert.equal(refResources.resolveEmbed('duplicate#^same').kind, 'missing');
  assert.equal(refResources.resolveEmbed('reference#不存在').kind, 'missing');
  assert.equal(refResources.resolveEmbed('reference#100%25%20完成').kind, 'document');
  assert.equal(refResources.resolveEmbed('reference#100%2525').kind, 'missing');
  assert.doesNotMatch(toHtml(await renderRefs('甲 ^same\n\n乙 ^same')), /id="block-same"/);
  assert.equal(refResources.resolveEmbed('#^intro', 'reference').kind, 'document');
  const refLinks = toHtml(await renderRefs('[[reference#引用章节]]、[[#^intro|目标段落]]、[[reference#别的父标题#子标题]]、[[reference#不存在]]'));
  assert.match(refLinks, /href="\/posts\/reference\/#article-%E5%BC%95%E7%94%A8%E7%AB%A0%E8%8A%82-1"/);
  assert.match(refLinks, /引用示例 › 引用章节/);
  assert.match(refLinks, /href="\/posts\/reference\/#block-intro">目标段落/);
  assert.match(refLinks, /#article-%E5%AD%90%E6%A0%87%E9%A2%98-2/);
  assert.match(refLinks, /article-content-ref-missing/);
  const chapterHtml = toHtml(await renderRefs('![[reference#引用章节]]'));
  assert.match(chapterHtml, /引用章节 · /);
  assert.match(chapterHtml, /下级内容/);
  assert.match(chapterHtml, /href="https:\/\/example.com\/reference"/);
  assert.doesNotMatch(chapterHtml, /开场内容|不要出现在章节嵌入中|同名标题的第二处/);
  const introHtml = toHtml(await renderRefs('![[reference#^intro]]'));
  assert.match(introHtml, /引用片段 · /);
  assert.match(introHtml, /目标段落 <strong>加粗<\/strong>/);
  assert.doesNotMatch(introHtml, /下级内容|不要出现在章节嵌入中/);
  assert.match(toHtml(await renderRefs('![[reference#^task]]')), /<li><input[^>]*checked/);
  assert.match(toHtml(await renderRefs('![[reference#^table]]')), /<table>/);
  assert.match(toHtml(await renderRefs('![[reference#^quote]]')), /<blockquote>/);
  assert.match(toHtml(await renderRefs('![[reference#^code]]')), /<pre[^>]*data-language="Markdown"/);
  const selfEmbed = toHtml(await renderRefs('![[#^intro]]'));
  assert.match(selfEmbed, /目标段落/);
  assert.doesNotMatch(selfEmbed, /已停止重复/);
  const repeated = toHtml(await renderRefs('![[reference#引用章节]]\n\n![[reference#引用章节]]'));
  const ids = [...repeated.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(ids.length, new Set(ids).size, '重复嵌入必须使用独立锚点');
  const loop = toHtml(await renderRefs('![[loop#自嵌入]]'));
  assert.match(loop, /已停止重复或过深的嵌入/);
  const literalRefs = toHtml(await renderRefs('```markdown\n[[reference#引用章节]]\n![[reference#^intro]]\n段落 ^literal\n```'));
  assert.doesNotMatch(literalRefs, /class="article-content-ref|class="article-embed-note|id="article-block/);
  assert.match(literalRefs, /\^literal/);
} finally { rmSync(publicDir, { recursive: true, force: true }); }
console.log('Markdown verification passed: line breaks, GFM, callouts, highlighting, MathJax, Pele, references, and HTML safety.');
