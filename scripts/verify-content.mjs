import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';

const contentDir = resolve('src/content/posts');
const publicDir = resolve('public');
const files = readdirSync(contentDir).filter((name) => extname(name) === '.md').sort();
const townIds = new Map();
const failures = [];

for (const name of files) {
  const path = join(contentDir, name);
  const source = readFileSync(path, 'utf8');
  const frontmatter = source.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!frontmatter) {
    failures.push(`${name}: missing YAML frontmatter`);
    continue;
  }
  const townId = frontmatter[1].match(/^townId:\s*["']?(.+?)["']?\s*$/m)?.[1];
  const title = frontmatter[1].match(/^title:\s*["']?(.+?)["']?\s*$/m)?.[1];
  if (!townId) failures.push(`${name}: missing townId`);
  if (!title) failures.push(`${name}: missing title`);
  if (townId && townIds.has(townId)) failures.push(`${name}: duplicate townId ${townId} (also in ${townIds.get(townId)})`);
  if (townId) townIds.set(townId, name);

  const body = source.slice(frontmatter[0].length);
  // Markdown links inside fenced or inline code are examples, not references.
  const prose = body
    .replace(/```[\s\S]*?```/g, '')
    .replace(/~~~[\s\S]*?~~~/g, '')
    .replace(/`[^`\n]*`/g, '');

  const localReferences = [...prose.matchAll(/(?:\]\(|(?:src|href)=["'])(\/[^)"']+)/g)].map((match) => match[1]);
  for (const reference of localReferences) {
    let clean;
    try { clean = decodeURIComponent(reference.split(/[?#]/, 1)[0]); }
    catch { failures.push(`${name}: invalid URL encoding in ${reference}`); continue; }
    if (!existsSync(join(publicDir, clean.replace(/^\//, '')))) failures.push(`${name}: missing public asset ${reference}`);
  }

  const relativeReferences = [...prose.matchAll(/!?\[[^\]]*\]\((?!https?:\/\/|mailto:|#|\/)([^)]+)\)/g)].map((match) => match[1]);
  for (const reference of relativeReferences) failures.push(`${name}: unresolved relative link ${reference}`);
}

if (failures.length) throw new Error(`Content verification failed:\n- ${failures.join('\n- ')}`);
console.log(JSON.stringify({ postCount: files.length, uniqueTownIds: townIds.size, files: files.map((name) => basename(name)) }, null, 2));
