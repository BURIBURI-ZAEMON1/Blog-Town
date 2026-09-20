# 积木小镇博客框架

这是一个基于 **Astro + React + Babylon.js** 的静态博客框架。文章会在首页的小镇中生成对应建筑；同一系列的文章会组成同一栋建筑的不同楼层。

当前仓库已经完成模板化清理：原博客的文章、站点名称、作者资料、联系方式、友链、Logo、头像、文章图片与附件均已移除。仓库中保留的 Logo、头像和 favicon 仅为通用占位图，使用前请替换。

## 1. 快速开始

环境要求：Node.js 20 或更高版本。

```bash
npm install
npm run dev
```

开发服务器启动后，根据终端输出访问本地地址。

提交或部署前建议运行完整检查：

```bash
npm run verify
```

生成静态站点：

```bash
npm run build
```

构建结果会输出到 `dist/`。

## 2. 必须先填写的站点信息

所有站点与作者信息集中在：

```text
src/config/site.ts
```

文件中每个需要填写的位置都附有行内注释。至少应修改以下字段：

| 字段 | 用途 |
| --- | --- |
| `title` | 完整网站名称，显示在侧边栏、浏览器标题和分享信息中 |
| `shortTitle` | 顶部导航和文章页脚使用的网站简称 |
| `tagline` | 网站副标题或英文名 |
| `description` | 网站简介，同时用于 SEO 与社交分享摘要 |
| `siteUrl` | 部署后的完整网址，例如 `https://blog.example.com/` |
| `language` | 页面语言，例如 `zh-CN` 或 `en-US` |
| `profile.name` | 作者名称 |
| `profile.headline` | 一句话介绍 |
| `profile.bio` | 作者简介 |
| `copyright` | 页面底部版权文字 |

`townSeed` 是可选的小镇布局随机种子。修改它会改变文章建筑的位置与外观；如果希望站点每次构建保持相同布局，请保持该值稳定。

> `siteUrl` 必须是包含协议的合法绝对地址。文章 canonical URL、Open Graph URL 和侧边栏网站链接都会使用它。

## 3. 图片与静态资产放置位置

所有可直接访问的静态文件都放在 `public/` 中。代码或 Markdown 中引用时，不写 `public`，从 `/` 开始填写路径。

| 资产 | 默认位置 | 配置位置 |
| --- | --- | --- |
| 网站 Logo | `public/assets/profile/logo.svg` | `siteConfig.logo` |
| 作者头像 | `public/assets/profile/avatar.svg` | `siteConfig.profile.avatar` |
| 浏览器图标 | `public/favicon.svg` | `src/layouts/TownAppPage.astro` |
| 相关网站 Logo | `public/assets/links/` | `siteConfig.profile.links` |
| 友链头像或站点 Logo | `public/assets/friends/` | `friendLinks` |
| 文章封面、正文图片和附件 | `public/assets/posts/<文章 ID>/` | 文章 Markdown |

可以继续使用 PNG、JPEG、WebP、SVG 等常见图片格式。替换图片后，如果扩展名发生变化，也要同步修改配置路径。

推荐的文章资产结构：

```text
public/assets/posts/
└── my-first-post/
    ├── cover.webp
    ├── image-01.webp
    └── files/
        └── example.zip
```

在文章中这样引用：

```md
![图片说明](/assets/posts/my-first-post/image-01.webp)

[下载附件](/assets/posts/my-first-post/files/example.zip)
```

## 4. 配置相关网站链接

相关网站链接位于 `src/config/site.ts` 的 `siteConfig.profile.links`。框架已经准备好常见平台的向量 Logo，所有平台默认处于整行注释状态。

启用时：

1. 在配置文件中找到目标平台。
2. 删除对应配置行开头的 `//`。
3. 只需把示例 `url` 替换成自己的链接；预置平台通常不需要修改 `id`、`label` 或 `logo`。
4. 每个平台保持一行，便于以后继续增加平台级自定义项。

示例：

```ts
links: [
  { id: 'github', label: 'GitHub', url: 'https://github.com/your-name', logo: '/assets/links/github.svg' },
  { id: 'email', label: '电子邮箱', url: 'mailto:you@example.com', logo: '/assets/links/email.svg' },
],
```

字段说明：

- `id`：站内唯一且稳定的标识，建议只使用小写字母、数字和连字符。
- `label`：无障碍标签和鼠标悬停提示。
- `url`：完整网页地址，也可以使用 `mailto:` 或站内路径。
- `logo`：Logo 文件路径。预置图标位于 `public/assets/links/`。

如果不需要相关网站链接，保持所有示例行被注释即可。完整平台清单和自定义 Logo 方法见本文档第 11 节。

## 5. 配置友链

友链位于 `src/config/site.ts` 的 `friendLinks`。默认没有任何友链，示例行已被注释。

启用时，把友邻头像或网站 Logo 放入 `public/assets/friends/`，然后删除示例行开头的 `//` 并填写信息：

```ts
export const friendLinks: FriendLink[] = [
  { id: 'friend-id', nickname: '友邻名称', avatar: '/assets/friends/friend-id.png', url: 'https://friend.example.com/', description: '可选的友邻简介' },
];
```

- `id`、`nickname`、`avatar`、`url` 为必填项。
- `description` 可选；不需要时可以删除 `description` 属性。
- 每位友邻单独占一行。
- `url` 应填写带 `http://` 或 `https://` 的完整地址。

## 6. 新建文章

文章目录：

```text
src/content/posts/
```

仓库提供了不会被构建系统读取的模板：

```text
src/content/posts/_article-template.md.example
```

复制并将文件扩展名改为 `.md`：

```bash
cp src/content/posts/_article-template.md.example src/content/posts/my-first-post.md
```

然后修改文件顶部 `---` 之间的 frontmatter 和下方正文。

### Frontmatter 字段

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `townId` | 是 | 全站唯一的永久 ID，同时用于 `/posts/<townId>/` 和小镇建筑定位。建议使用小写英文、数字、连字符，发布后不要随意修改 |
| `title` | 是 | 文章标题 |
| `description` | 是 | 文章摘要，用于列表、搜索和 SEO |
| `date` | 是 | 发布日期，建议使用包含时区的 ISO 8601 格式，例如 `2026-09-20T12:00:00+08:00` |
| `category` | 是 | 单一分类名称 |
| `tags` | 否 | 标签数组，例如 `["Astro", "博客"]`；不需要时填写 `[]` 或省略 |
| `draft` | 否 | `true` 时不发布；默认是 `false`，新文章建议先显式填写 `true` |
| `updatedAt` | 否 | 最后更新时间，格式与 `date` 相同 |
| `featured` | 否 | 推荐标记；当前主题暂未使用该字段进行视觉排序，保留供后续扩展 |
| `cover` | 否 | 封面根路径，必须以 `/` 开头 |
| `coverAlt` | 否 | 封面替代文字；使用封面时建议填写 |
| `series` | 否 | 系列名称；必须和 `seriesIndex` 同时出现 |
| `seriesIndex` | 否 | 系列内顺序，从 `0` 开始；同一系列内不可重复 |

### 发布规则

文章只有同时满足以下条件才会出现在站点中：

1. 文件扩展名为 `.md`，并位于 `src/content/posts/` 或其子目录中。
2. `draft` 为 `false` 或未填写。
3. `date` 不晚于构建时刻。
4. frontmatter 通过 `src/content.config.ts` 中的结构校验。

`townId` 必须在所有文章中唯一。系列文章还要求同一 `series` 下的 `seriesIndex` 唯一。`npm run verify` 会检查文章 ID 与本地静态文件引用。

### 系列与小镇建筑

- 普通文章通常各自生成一栋建筑。
- `series` 相同的文章会组成同一栋建筑。
- `seriesIndex: 0` 是系列第一篇，`1` 是第二篇，以此类推。
- 修改 `townId`、`series`、`seriesIndex` 或 `townSeed` 可能改变建筑映射。

## 7. Markdown 正文

正文支持常见 Markdown：

````md
## 二级标题

正文段落，支持 **粗体**、`行内代码` 和链接。

- 列表项
- 列表项

```ts
console.log('code block');
```
````

文章标题来自 frontmatter 的 `title`，正文一般从二级标题 `##` 开始。页面会根据正文标题生成文章目录，并计算字数和预计阅读时间。

## 8. 目录速查

```text
src/config/site.ts                     网站、作者、相关链接与友链配置
src/content.config.ts                  文章字段结构与校验规则
src/content/posts/                     Markdown 文章目录
src/content/posts/_article-template.md.example 文章模板
public/assets/profile/                 Logo 与头像
public/assets/links/                   相关网站 Logo
public/assets/friends/                 友链头像或 Logo
public/assets/posts/                   文章图片与附件
public/favicon.svg                     浏览器图标
src/styles/global.css                  全站样式
src/data/                              小镇布局、地图、天气与角色逻辑
src/scene/brick-town/                  Babylon.js 小镇渲染代码
```

`public/assets/brick-town/` 包含小镇环境资源及其许可文件。除非同时替换相关环境资源和授权说明，否则不要删除其中内容。

## 9. 常用命令

```bash
npm run dev              # 启动开发服务器
npm run check            # Astro 与 TypeScript 检查
npm run build            # 构建静态站点
npm run verify:content   # 检查文章 ID 与本地资源引用
npm run verify           # 执行完整检查、构建和小镇回归测试
npm run preview          # 本地预览 dist/ 构建结果
```

## 10. 部署

该项目输出纯静态文件，可以部署到支持静态站点的平台。部署前：

1. 将 `src/config/site.ts` 中的 `siteUrl` 改为正式域名。
2. 确认网站 Logo、头像和 favicon 已替换；如使用自定义相关网站 Logo 或友链图片，也确认文件已放入对应目录。
3. 将准备发布的文章设为 `draft: false`。
4. 运行 `npm run verify`。
5. 部署 `npm run build` 生成的 `dist/`。

## 11. 预置相关网站 Logo

相关网站配置位于 `src/config/site.ts` 的 `siteConfig.profile.links`。框架已经在 `public/assets/links/` 中准备了向量 Logo，配置时通常不需要自己寻找或上传图片。

当前预置类别包括：

- 通用：个人网站、邮箱、RSS
- 代码与职业：GitHub、GitLab、Stack Overflow、DEV Community、Medium、LinkedIn、Notion
- 国内平台：哔哩哔哩、微博、小红书、知乎、豆瓣、QQ、微信、爱发电
- 国际社交：X、Telegram、Discord、Instagram、Threads、TikTok、Facebook、Reddit、Mastodon、Bluesky、WhatsApp、LINE、Signal、Snapchat、Tumblr、VK
- 视频、直播、音乐与创作：YouTube、Twitch、Steam、Spotify、SoundCloud、Bandcamp、Pixiv、Niconico、Pinterest、Patreon、Ko-fi

启用一个网站时，只需：

1. 找到对应的注释行。
2. 删除行首的 `//`。
3. 把示例 URL 替换成自己的地址。
4. 保留对应的 `logo` 路径。

例如启用 X 和小红书：

```ts
links: [
  { id: 'x', label: 'X', url: 'https://x.com/your-name', logo: '/assets/links/x.svg' },
  { id: 'xiaohongshu', label: '小红书', url: 'https://www.xiaohongshu.com/user/profile/your-id', logo: '/assets/links/xiaohongshu.svg' },
],
```

每个平台一行，后续可以继续增加 `title`、`rel` 或其他自定义字段。框架会把链接排列成紧凑网格；链接数量较多时，个人资料区域内部会出现滚动条，侧边栏本身也支持滚动，不会因为链接过多撑破页面。

### 自定义 Logo

如果预置列表中没有需要的平台：

1. 将自己的 SVG、PNG 或 WebP 放入 `public/assets/links/`。
2. 在 `siteConfig.profile.links` 添加一行。
3. 将 `logo` 改成 `/assets/links/你的文件名.svg`。

推荐优先使用正方形 SVG。若使用带颜色的图片，建议保证在日间和夜间模式下都具有足够对比度。

### 版权与来源

大部分预置图标来自 Simple Icons，相关授权文件保存在 `public/assets/links/LICENSE-simple-icons.md`；邮箱、个人网站和 LinkedIn 图标为本框架附带的简单向量图标。平台 Logo 仅用于识别链接目标，不代表与这些平台存在官方合作关系。
