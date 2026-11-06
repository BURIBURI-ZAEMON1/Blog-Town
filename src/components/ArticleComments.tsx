import { useEffect, useRef, useState, type RefObject } from 'react';
import { commentConfig } from '../config/comments';
import { siteConfig } from '../config/site';

const SESSION_KEY = 'giscus-session';
type Status = 'waiting' | 'ready' | 'error';
type Props = {
  postId: string;
  title: string;
  colorMode: 'day' | 'night';
  scrollRoot: RefObject<HTMLElement | null>;
};

function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch { /* The current session still works without storage. */ }
}

function readSession() {
  const url = new URL(window.location.href);
  const returned = url.searchParams.get('giscus');
  if (returned) {
    try { localStorage.setItem(SESSION_KEY, JSON.stringify(returned)); } catch { /* Use the session in memory. */ }
    url.searchParams.delete('giscus');
    // Preserve the blog's history entry and fragment when finishing sign-in.
    window.history.replaceState(window.history.state, '', url);
    return returned;
  }
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null');
    return typeof saved === 'string' ? saved : '';
  } catch { clearSession(); return ''; }
}

// The iframe speaks giscus' documented message protocol directly. It is scoped
// to this article, so SPA navigation cannot reuse another article's thread.
export default function ArticleComments({ postId, title, colorMode, scrollRoot }: Props) {
  const containerRef = useRef<HTMLElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const themeRef = useRef<string>(commentConfig.themes[colorMode]);
  themeRef.current = commentConfig.themes[colorMode];
  const [source, setSource] = useState('');
  const [status, setStatus] = useState<Status>('waiting');
  const [attempt, setAttempt] = useState(0);
  const [height, setHeight] = useState(280);
  const errorReceived = useRef(false);

  useEffect(() => {
    const element = containerRef.current;
    if (!commentConfig.enabled || !element) return;
    let timeout: number | undefined;
    let started = false;
    let handshakeComplete = false;
    const sendTheme = () => frameRef.current?.contentWindow?.postMessage({ giscus: { setConfig: { theme: themeRef.current } } }, commentConfig.host);
    const receiveMessage = (event: MessageEvent) => {
      if (event.origin !== commentConfig.host || event.source !== frameRef.current?.contentWindow) return;
      const data = event.data?.giscus;
      if (!data || typeof data !== 'object') return;
      if (data.signOut) {
        clearSession(); setSource(''); setAttempt((value) => value + 1); return;
      }
      if (typeof data.error === 'string' && !data.error.includes('Discussion not found')) {
        if (/Bad credentials|Invalid state value|State has expired/.test(data.error)) clearSession();
        errorReceived.current = true;
        setStatus('error');
        if (timeout !== undefined) window.clearTimeout(timeout);
        return;
      }
      if (typeof data.resizeHeight === 'number' && Number.isFinite(data.resizeHeight) && data.resizeHeight > 0 && data.resizeHeight <= 100_000) {
        setHeight(Math.ceil(data.resizeHeight));
        if (!errorReceived.current) setStatus('ready');
        if (timeout !== undefined) window.clearTimeout(timeout);
        if (!handshakeComplete) { handshakeComplete = true; sendTheme(); }
      }
    };
    const start = () => {
      if (started) return;
      started = true;
      if (![commentConfig.repo, commentConfig.repoId, commentConfig.category, commentConfig.categoryId].every((value) => value.trim())) {
        setStatus('error');
        return;
      }
      errorReceived.current = false;
      setStatus('waiting');
      const backLink = new URL(`/posts/${encodeURIComponent(postId)}/`, siteConfig.siteUrl).href;
      const origin = new URL(window.location.href);
      const session = readSession();
      origin.searchParams.delete('giscus');
      origin.hash = 'article-comments';
      const params = new URLSearchParams({
        repo: commentConfig.repo, repoId: commentConfig.repoId,
        category: commentConfig.category, categoryId: commentConfig.categoryId,
        term: postId, strict: '1', description: title, backLink,
        origin: origin.href, session, theme: themeRef.current,
        reactionsEnabled: '1', emitMetadata: '1', inputPosition: 'top',
      });
      setSource(`${commentConfig.host}/${commentConfig.language}/widget?${params}`);
      timeout = window.setTimeout(() => setStatus('error'), 20_000);
    };
    window.addEventListener('message', receiveMessage);
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) { observer.disconnect(); start(); }
    }, { root: scrollRoot.current, rootMargin: '400px 0px' });
    observer.observe(element);
    return () => {
      observer.disconnect();
      window.removeEventListener('message', receiveMessage);
      if (timeout !== undefined) window.clearTimeout(timeout);
    };
  }, [postId, title, attempt, scrollRoot]);

  useEffect(() => {
    frameRef.current?.contentWindow?.postMessage({ giscus: { setConfig: { theme: commentConfig.themes[colorMode] } } }, commentConfig.host);
  }, [colorMode]);

  if (!commentConfig.enabled) return null;
  return <section ref={containerRef} id="article-comments" className="article-comments" aria-labelledby="article-comments-title">
    <header className="article-comments-heading"><h2 id="article-comments-title">评论</h2><a href={`https://github.com/${commentConfig.repo}/discussions`} target="_blank" rel="noreferrer noopener">GitHub Discussions <span aria-hidden="true">↗</span></a></header>
    <p className="article-comments-intro">欢迎留下想法或问题，使用 GitHub 账号即可参与。</p>
    <div className="article-comments-widget" aria-busy={status === 'waiting'}>
      {status === 'waiting' && <p className="article-comments-status" role="status">正在加载评论…</p>}
      {status === 'error' && <div className="article-comments-status" role="status"><p>评论暂时无法加载，你可以稍后重试，或前往 GitHub 查看讨论。</p><button type="button" onClick={() => { setSource(''); setStatus('waiting'); setAttempt((value) => value + 1); }}>重新加载</button></div>}
      {/* Keep iframe layout active while waiting for its first resize message. */}
      {source && <iframe ref={frameRef} key={`${postId}:${attempt}`} className="giscus-frame" title="文章评论" tabIndex={status === 'ready' ? 0 : -1} aria-hidden={status !== 'ready'} src={source} allow="clipboard-write" referrerPolicy="strict-origin-when-cross-origin"
        style={{ height, pointerEvents: status === 'ready' ? undefined : 'none', opacity: status === 'ready' ? 1 : 0, display: status === 'error' ? 'none' : undefined }} />}
    </div>
  </section>;
}
