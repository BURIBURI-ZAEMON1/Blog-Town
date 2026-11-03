import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

function formatLocalDate(date) {
  const pad = (value) => String(value).padStart(2, '0');
  const offset = -date.getTimezoneOffset();
  const zone = `${offset >= 0 ? '+' : '-'}${pad(Math.floor(Math.abs(offset) / 60))}:${pad(Math.abs(offset) % 60)}`;
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}${zone}`;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) {
    console.log('用法：pnpm new "My New Post"\n也支持：npm run new -- "My New Post"');
    return;
  }
  if (args.length !== 1) throw new Error('请提供一个英文文件名；含空格时请加引号。例如：pnpm new "My New Post"');

  const name = args[0].trim().replace(/\.md$/i, '');
  if (!/^[a-z0-9]+(?:[\s_-]+[a-z0-9]+)*$/i.test(name)) {
    throw new Error('文件名只能包含英文字母、数字、空格、连字符或下划线，不能包含目录路径。');
  }
  const slug = name.toLowerCase().replace(/[\s_]+/g, '-').replace(/-+/g, '-');
  const directory = new URL('../src/content/posts/', import.meta.url);
  const destination = new URL(`${slug}.md`, directory);
  const source = `---
townId: post-${slug}
title:
description:
date: ${formatLocalDate(new Date())}
category:
tags:
  -
  -
cover: /assets/posts/
coverAlt:
draft: true
---

`;

  await mkdir(directory, { recursive: true });
  try {
    await writeFile(destination, source, { encoding: 'utf8', flag: 'wx' });
  } catch (error) {
    if (error.code === 'EEXIST') throw new Error(`文件已存在，未覆盖：${fileURLToPath(destination)}`);
    throw error;
  }
  console.log(`已创建草稿：${fileURLToPath(destination)}`);
  console.log('请补齐标题、摘要、分类和标签；确认可以发布后将 draft 改为 false。');
}

main().catch((error) => {
  console.error(`新建文章失败：${error.message}`);
  process.exitCode = 1;
});
