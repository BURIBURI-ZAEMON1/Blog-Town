import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { siteConfig } from '../src/config/site.ts';

// Load emitted ESM files as Vercel does; a mocked require hides invalid imports.
const output = mkdtempSync(join(tmpdir(), 'town-view-proxy-'));
let handler;
try {
  writeFileSync(join(output, 'package.json'), '{"type":"module"}');
  for (const path of ['api/views.ts', 'src/config/site.ts', 'src/lib/site-origin.ts']) {
    const target = join(output, path.replace(/\.ts$/, '.js'));
    mkdirSync(dirname(target), { recursive: true });
    const code = ts.transpileModule(readFileSync(path, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    writeFileSync(target, code);
  }
  handler = (await import(pathToFileURL(join(output, 'api/views.js')).href)).default;
} finally { rmSync(output, { recursive: true, force: true }); }
const savedFetch = globalThis.fetch, savedEnv = process.env.VERCEL_ENV;
const origin = new URL(siteConfig.siteUrl);
const requests = [];
let mode;
const visitor = '00000000-0000-4000-8000-000000000001';
const base = { method: 'POST', query: { path: '/posts/test/' }, headers: { host: origin.host, origin: origin.origin, 'x-town-visitor': visitor } };
const invoke = async (changes = {}) => {
  const response = { code: 200, headers: {}, status(code) { this.code = code; return this; }, setHeader(key, value) { this.headers[key] = value; }, json(value) { this.body = value; } };
  await handler({ ...base, ...changes }, response);
  return response;
};
try {
  process.env.VERCEL_ENV = 'production';
  globalThis.fetch = async (url, options) => {
    requests.push({ url, options });
    if (mode === 'offline') throw new TypeError('offline');
    return { ok: true, headers: new Headers({ 'Set-Bsz-Identity': 'signed.identity' }), json: async () => mode === 'invalid' ? { success: true, data: { page_uv: -1 } } : ({ success: true, data: { page_pv: 77, page_uv: 5, site_pv: 100, site_uv: 10 } }) };
  };
  const result = await invoke();
  assert.equal(result.code, 200);
  assert.deepEqual(result.body, { success: true, data: { page_uv: 5, site_pv: 100, site_uv: 10 } });
  assert.equal(result.headers['Cache-Control'], 'no-store');
  assert.equal(result.headers['Set-Bsz-Identity'], 'signed.identity');
  assert.equal(requests[0].url, 'https://bsz.dusays.com/api');
  assert.equal(requests[0].options.headers['x-bsz-referer'], new URL('/posts/test/', siteConfig.siteUrl).href);
  assert.equal(requests[0].options.headers['User-Agent'], `TownBlog/1 ${visitor}`);
  await invoke({ method: 'GET', headers: { ...base.headers, authorization: 'Bearer signed.identity' } });
  assert.equal(requests.at(-1).options.method, 'GET', 'read-only recovery counted another visit');
  assert.equal(requests.at(-1).options.headers.Authorization, 'Bearer signed.identity');
  await invoke({ headers: { ...base.headers, 'x-town-visitor': '00000000-0000-4000-8000-000000000002' } });
  assert.notEqual(requests.at(-1).options.headers['User-Agent'], requests[0].options.headers['User-Agent'], 'proxy merged different visitors into one server identity');
  const alias = new URL(origin);
  alias.hostname = alias.hostname.startsWith('www.') ? alias.hostname.slice(4) : `www.${alias.hostname}`;
  assert.equal((await invoke({ headers: { ...base.headers, host: alias.host, origin: alias.origin } })).code, 200, 'www/bare domain alias was rejected');
  assert.equal(requests.at(-1).options.headers['x-bsz-referer'], new URL('/posts/test/', siteConfig.siteUrl).href, 'alias fragmented site totals');
  const before = requests.length;
  for (const changes of [
    { headers: { ...base.headers, origin: 'https://other.invalid' } },
    { headers: { ...base.headers, host: 'preview.invalid' } },
    { headers: { ...base.headers, host: `${origin.hostname}.evil.invalid` } },
    { headers: { ...base.headers, origin: `http://${origin.host}` } },
    { headers: { ...base.headers, 'sec-fetch-site': 'cross-site' } },
    { method: 'PUT' }, { query: { path: '//other.invalid/' } }, { query: { path: '/posts/a/?secret=x' } },
    { query: { path: ['/about/', '/'] } }, { query: { path: '/posts/%2e%2e/' } }, { headers: { ...base.headers, 'x-town-visitor': 'bad\r\nvalue' } },
    { headers: { ...base.headers, authorization: 'Bearer invalid\r\ntoken' } }, { headers: { ...base.headers, authorization: 'unprefixed' } },
  ]) assert((await invoke(changes)).code >= 400);
  process.env.VERCEL_ENV = 'preview'; assert.equal((await invoke()).code, 403);
  assert.equal(requests.length, before, 'invalid or preview traffic reached the counter');
  process.env.VERCEL_ENV = 'production';
  for (mode of ['offline', 'invalid']) assert.equal((await invoke()).code, 503);
  console.log('PASS: emitted ESM function startup, canonical www/bare hostnames, same-origin proxy, stable separate visitor identities, existing tokens, read-only recovery, validation, preview isolation and upstream failure handling');
} finally {
  globalThis.fetch = savedFetch;
  if (savedEnv === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = savedEnv;
}
