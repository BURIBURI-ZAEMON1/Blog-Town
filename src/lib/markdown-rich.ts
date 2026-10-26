// These renderers run only during content generation; no diagram, highlighter,
// or MathJax runtime is shipped to readers.
import { createHighlighter, bundledLanguages, type BundledLanguage } from 'shiki';
import { render as renderDiagram } from 'pele';
import { mathjax } from '@mathjax/src/js/mathjax.js';
import { TeX } from '@mathjax/src/js/input/tex.js';
import { SVG } from '@mathjax/src/js/output/svg.js';
import { MathJaxNewcmFont } from '@mathjax/mathjax-newcm-font/mjs/svg.js';
import { liteAdaptor } from '@mathjax/src/js/adaptors/liteAdaptor.js';
import { RegisterHTMLHandler } from '@mathjax/src/js/handlers/html.js';
import '@mathjax/src/js/input/tex/ams/AmsConfiguration.js';
import '@mathjax/src/js/input/tex/newcommand/NewcommandConfiguration.js';
import '@mathjax/src/js/input/tex/noundefined/NoUndefinedConfiguration.js';

export const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]!));

const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);
mathjax.asyncLoad = (name: string) => import(/* @vite-ignore */ name);
let highlighter: ReturnType<typeof createHighlighter> | undefined;
const getHighlighter = () => highlighter ??= createHighlighter({
  themes: ['github-light', 'github-dark'], langs: [],
});

const languageLabels: Record<string, string> = {
  js: 'JavaScript', javascript: 'JavaScript', jsx: 'JSX', ts: 'TypeScript', typescript: 'TypeScript', tsx: 'TSX',
  py: 'Python', python: 'Python', sh: 'Shell', shell: 'Shell', bash: 'Bash', zsh: 'Zsh', powershell: 'PowerShell',
  json: 'JSON', yaml: 'YAML', yml: 'YAML', html: 'HTML', css: 'CSS', scss: 'SCSS', sql: 'SQL',
  md: 'Markdown', markdown: 'Markdown', c: 'C', cpp: 'C++', java: 'Java', go: 'Go', rust: 'Rust',
};

export async function renderCode(text: string, info = '') {
  const requested = info.trim().split(/\s+/)[0].toLowerCase();
  const lang = Object.hasOwn(bundledLanguages, requested) ? requested as BundledLanguage : 'text';
  const engine = await getHighlighter();
  if (lang !== 'text') await engine.loadLanguage(lang);
  const html = engine.codeToHtml(text, {
    lang, themes: { light: 'github-light', dark: 'github-dark' }, defaultColor: false,
  });
  const label = requested ? languageLabels[requested] ?? requested : '';
  return label ? html.replace('<pre ', `<pre data-language="${escapeHtml(label)}" `) : html;
}

export function createMathRenderer() {
  // A separate TeX instance prevents author-defined macros leaking between posts.
  // Deliberately omit HTML, require, and autoload packages: TeX cannot introduce
  // links, arbitrary HTML, or fetch scripts from the article source.
  const document = mathjax.document('', {
    InputJax: new TeX({ packages: ['base', 'ams', 'newcommand', 'noundefined'], maxBuffer: 20_000 }),
    OutputJax: new SVG({ fontData: MathJaxNewcmFont, fontCache: 'none' }),
  });
  return async (tex: string, display: boolean) => {
    const node = await mathjax.handleRetriesFor(() => document.convert(tex, { display }));
    const html = adaptor.outerHTML(node);
    if (html.includes('data-mml-node="merror"')) throw new Error('公式语法有误');
    const tag = display ? 'div' : 'span';
    return `<${tag} class="article-math${display ? ' is-display' : ''}" role="math" aria-label="${escapeHtml(tex)}">${html}</${tag}>`;
  };
}

export function renderPele(text: string, idPrefix: string) {
  // Pele escapes labels and filters styles; disable diagram-defined links and
  // images so generated SVG stays a self-contained document fragment.
  const { svg } = renderDiagram(text, {
    idPrefix, responsive: true, fontFamily: 'sans-serif', fontSize: 14,
    links: false, images: false, maxEdges: 1000,
  });
  return `<figure class="article-diagram" aria-label="文章图表">${svg}</figure>`;
}

export function renderSourceError(message: string, source: string) {
  return `<details class="article-render-error"><summary>${escapeHtml(message)} · 查看原文</summary><pre><code>${escapeHtml(source)}</code></pre></details>`;
}
