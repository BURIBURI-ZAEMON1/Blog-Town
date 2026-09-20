import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }), // 文章统一放在 src/content/posts，可使用子目录。
  schema: z.object({
    townId: z.string().min(1), // 必填：文章永久 ID，同时用于文章 URL 与小镇建筑定位；所有文章必须唯一。
    title: z.string().min(1), // 必填：文章标题。
    description: z.string().min(1), // 必填：文章摘要，用于列表、搜索与 SEO。
    category: z.string().min(1), // 必填：文章分类。
    tags: z.array(z.string().min(1)).default([]), // 可选：标签数组；不需要时填写 [] 或省略。
    series: z.string().min(1).optional(), // 可选：系列名称；启用时必须同时填写 seriesIndex。
    seriesIndex: z.number().int().min(0).optional(), // 可选：系列内从 0 开始的顺序；同一系列内不可重复。
    date: z.coerce.date(), // 必填：发布日期；晚于构建时间的文章不会发布。
    updatedAt: z.coerce.date().optional(), // 可选：最后更新时间。
    draft: z.boolean().default(false), // 可选：true 时不发布，建议新文章先设为 true。
    featured: z.boolean().default(false), // 可选：保留的推荐标记，便于后续扩展展示规则。
    cover: z.string().startsWith('/').optional(), // 可选：封面根路径，例如 /assets/posts/my-post/cover.webp。
    coverAlt: z.string().optional(), // 可选：封面替代文字；有封面时建议填写。
  }).superRefine((post, context) => {
    if ((post.series && post.seriesIndex === undefined) || (!post.series && post.seriesIndex !== undefined)) {
      context.addIssue({ code: 'custom', message: 'series and seriesIndex must be provided together' });
    }
  }),
});

export const collections = { posts };
