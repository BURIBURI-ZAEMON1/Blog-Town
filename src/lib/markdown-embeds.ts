import { readdirSync } from 'node:fs';
import { basename, extname, posix, resolve } from 'node:path';
import { escapeHtml } from './markdown-rich';

export interface EmbedDocument {
  key: string;
  title: string;
  markdown: string;
  href: string;
  assetDirectory?: string;
}
export type EmbedResource =
  | { kind: 'file'; url: string; name: string; extension: string }
  | { kind: 'document'; document: EmbedDocument }
  | { kind: 'missing'; message: string };
export interface MarkdownResources {
  resolveEmbed: (reference: string, documentKey?: string) => EmbedResource;
}

// Index only public assets and explicitly supplied published articles. Vault
// paths, symlinks, draft posts, and files outside public are never read.
export function createMarkdownResources(publicDirectory: string, documents: EmbedDocument[] = []): MarkdownResources {
  const files = new Set<string>();
  const scan = (directory: string, prefix = '') => {
    for (const item of readdirSync(directory, { withFileTypes: true })) {
      if (item.name.startsWith('.')) continue;
      const relative = posix.join(prefix, item.name);
      if (item.isDirectory()) scan(resolve(directory, item.name), relative);
      else if (item.isFile()) files.add(relative);
    }
  };
  scan(publicDirectory);
  const documentByKey = new Map(documents.map((document) => [document.key, document]));
  const missing = (message: string): EmbedResource => ({ kind: 'missing', message });
  const file = (path: string, suffix = ''): EmbedResource => ({
    kind: 'file', url: `/${path.split('/').map(encodeURIComponent).join('/')}${suffix}`,
    name: basename(path), extension: extname(path).slice(1).toLowerCase(),
  });
  return {
    resolveEmbed(reference, documentKey) {
      let decoded: string;
      try { decoded = decodeURI(reference.trim()).replaceAll('\\', '/'); }
      catch { return missing(`文件路径编码有误：${reference}`); }
      if (/^https?:\/\//i.test(decoded)) {
        try {
          const url = new URL(reference.trim());
          return { kind: 'file', url: url.href, name: basename(decodeURI(url.pathname)), extension: extname(url.pathname).slice(1).toLowerCase() };
        } catch { return missing(`文件地址有误：${reference}`); }
      }
      if (!decoded || /[\u0000-\u001f\u007f]/.test(decoded) || /^[a-z][\w+.-]*:/i.test(decoded) || decoded.startsWith('//')) {
        return missing(`不支持的文件地址：${reference}`);
      }
      const fragmentAt = decoded.search(/[?#]/);
      const path = (fragmentAt < 0 ? decoded : decoded.slice(0, fragmentAt)).replace(/^\/(?:public\/)?|^public\//, '').replace(/^\.\//, '');
      const suffix = fragmentAt < 0 ? '' : decoded.slice(fragmentAt);
      if (!path || path.split('/').includes('..')) return missing(`不支持的文件路径：${reference}`);
      const isRoot = decoded.startsWith('/') || decoded.startsWith('public/');
      const owner = documentKey ? documentByKey.get(documentKey) : undefined;
      if (!isRoot && owner?.assetDirectory) {
        const relative = posix.join(owner.assetDirectory.replace(/^\//, ''), path);
        if (files.has(relative)) return file(relative, suffix);
      }
      if (files.has(path)) return file(path, suffix);

      // Notes can be embedded without introducing wiki navigation/backlinks.
      // Exact content paths win; short names/titles must be unambiguous.
      const noteName = path.replace(/\.md$/i, '');
      if (!isRoot && (!extname(path) || /\.md$/i.test(path))) {
        const relativeKey = owner ? posix.join(posix.dirname(owner.key), noteName) : noteName;
        const exact = documentByKey.get(relativeKey) ?? documentByKey.get(noteName);
        const matches = exact ? [exact] : documents.filter((document) => basename(document.key) === noteName || document.title === noteName);
        if (matches.length > 1) return missing(`文章名称不唯一，请填写完整路径：${reference}`);
        if (matches.length === 1) {
          if (suffix) return missing(`文章嵌入暂不支持章节或块引用，请嵌入整篇文章：${reference}`);
          return { kind: 'document', document: matches[0] };
        }
      }
      if (!isRoot) {
        const matches = [...files].filter((candidate) => candidate.endsWith(`/${path}`));
        if (matches.length === 1) return file(matches[0], suffix);
        if (matches.length > 1) return missing(`文件名称不唯一，请填写完整路径：${reference}`);
      }
      return missing(`找不到文件或已发布文章：${reference}`);
    },
  };
}

export function renderFileEmbed(resource: Extract<EmbedResource, { kind: 'file' }>, label: string, inline: boolean, embedKey = '') {
  const url = escapeHtml(resource.url);
  const dimensions = /^(\d{1,4})(?:x(\d{1,4}))?$/.exec(label);
  const width = dimensions && Number(dimensions[1]) > 0 ? Number(dimensions[1]) : undefined;
  const height = dimensions?.[2] && Number(dimensions[2]) > 0 ? Number(dimensions[2]) : undefined;
  const name = escapeHtml(dimensions ? resource.name : label || resource.name);
  const attrs = `${width ? ` width="${width}"` : ''}${height ? ` height="${height}"` : ''}`;
  const wrap = (content: string) => inline ? content : `<div class="article-embed article-file-embed"${embedKey ? ` data-embed-key="${escapeHtml(embedKey)}"` : ''} role="group"><div class="embed-file-summary" role="button" tabindex="0" aria-expanded="true">${name}<span class="embed-note-toggle" aria-hidden="true"></span></div><div class="article-embed-body">${content}</div></div>`;
  if (/^(png|jpe?g|gif|webp|avif|svg|bmp)$/.test(resource.extension)) {
    const image = `<img class="article-embed-image" src="${url}" alt="${name}"${attrs} loading="lazy" decoding="async" />`;
    return inline ? image : wrap(`<figure>${image}</figure>`);
  }
  if (/^(mp3|wav|ogg|m4a|aac|flac|opus)$/.test(resource.extension)) {
    return wrap(`<audio class="article-embed-audio" controls preload="metadata" src="${url}" aria-label="${name}"><a href="${url}">收听 ${name}</a></audio>`);
  }
  if (/^(mp4|webm|mov|m4v|ogv)$/.test(resource.extension)) {
    return wrap(`<video class="article-embed-video" controls preload="metadata" playsinline src="${url}" aria-label="${name}"${attrs}><a href="${url}">观看 ${name}</a></video>`);
  }
  const link = `<a class="article-embed-file" href="${url}" target="_blank" rel="noreferrer noopener">${name}<span class="external-link-icon" aria-hidden="true"></span></a>`;
  if (resource.extension === 'pdf' && !inline) {
    return wrap(`<object class="article-embed-pdf" data="${url}" type="application/pdf" aria-label="${name}">${link}</object><figcaption>${link}</figcaption>`);
  }
  return inline ? link : wrap(link);
}
