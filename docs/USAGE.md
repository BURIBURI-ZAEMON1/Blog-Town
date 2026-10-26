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

正文支持常见 Markdown 和 Obsidian 风格扩展，完整写法见第 13 节：

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
npm run verify:markdown  # 检查 Markdown、公式、图表、嵌入与 HTML 安全过滤
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

## 12. 四季小镇

顶部的「小镇季节」菜单可直接选择春、夏、秋、冬；「当季」按访客设备的本地月份自动选择北半球气象季节：3–5 月为春，6–8 月为夏，9–11 月为秋，12–2 月为冬。手动选择在当前页面会话内保持，刷新后恢复「当季」。昼夜与季节可以独立切换。

四季共享同一份布局、文章建筑、河流、道路和小地图坐标。换季仅更新材质并替换覆盖物，不重新创建渲染器或重置缩放和平移。

- 春：明亮的新绿与批量花朵。
- 夏：保留原有小镇的绿色、树冠和水面。
- 秋：金黄及橙色树冠、泛黄地表、树旁的静态落叶砖块。
- 冬：雪地、根据建模阶段记录的表面生成屋顶/树冠/栏杆等雪盖、冰面；有降水时显示雪花，其他季节显示雨。

降水仍每 15 分钟按站点种子和时间段确定，概率为 30%；冬季不会持续强制下雪。季节覆盖物不会随着天气累计增长。切换使用约 0.85 秒的材质渐变与覆盖层淡入，尚未模拟逐砖积雪和融雪。减少动态效果偏好会立即完成换季，停止行人/水光动画并隐藏动态降水。手机会降低覆盖物与雨雪数量；画面离开视口或页面隐藏时暂停渲染。

维护入口：

```text
src/data/town-seasons.ts          四季配色、天气类型与月份选择
src/data/town-weather.ts          统一雨雪数据与确定性天气
src/scene/brick-town/seasons.ts   季节材质、覆盖层、转场与释放
src/scene/brick-town/surfaces.ts  建模时注册的可积雪表面
src/scene/brick-town/weather.ts   共享雨雪渲染及运动生命周期
```

运行 `npm run verify:seasons` 可检查换季时布局和基础网格稳定、覆盖物避让、雪盖拾取、反复切换资源释放及减少动态效果；`npm run verify` 已包含该检查。


## 13. 富 Markdown 与 Obsidian 风格扩展

文章继续放在 `src/content/posts/`，无需更换文件格式。渲染结果在构建时生成，不依赖读者浏览器下载代码高亮、MathJax 或图表渲染引擎。

### 基础排版与代码

普通段落中的单换行直接显示为换行，空行另起段落。支持标题、粗体、斜体、引用、有序／无序列表、表格、分隔线、图片、链接，以及：

```markdown
~~删除线~~
==高亮文字==

- [ ] 未完成任务
- [x] 已完成任务

[外部文档](https://example.com)
```

外部链接有下划线和末尾的链接图标，并在新标签页打开。任务列表作为文章内容展示，复选框不可交互。

多行代码用三个反引号围起，在开头标注语言。Shiki 按明暗主题显示高亮；常用标记包括 `js`、`javascript`、`ts`、`typescript`、`tsx`、`jsx`、`python`、`bash`、`shell`、`powershell`、`json`、`yaml`、`html`、`css`、`sql`、`java`、`c`、`cpp`、`go`、`rust`。语言名不区分大小写；未指定或未知语言保留为纯文本代码块。

### 提示框

用 `> [!颜色] 可选标题` 开始，后续内容继续使用引用语法。支持 `red`、`blue`、`yellow`、`green`、`purple` 和 `gary`（也接受 `gray`、`grey`）。标题使用深色，背景使用同色系浅色；没有前置图标。

```markdown
> [!blue] 阅读提示
> 支持 **粗体**、==高亮==、链接、列表、代码与公式。
> 每一行继续以 > 开始。
>
> > [!purple]- 嵌套且默认收起
> > 这里是内层内容。

> [!red]+ 默认展开，可点击标题折叠
> 内容。

> [!green]
> 不需要标题时省略标题。

> [!]- 不指定颜色，默认蓝色
> 默认收起的内容。
```

`[!颜色]+` 默认展开，`[!颜色]-` 默认收起；没有 `+`／`-` 时为普通提示框。可折叠框没有标题时显示「提示」。使用键盘可聚焦标题，再按 Enter 或空格展开。

### 数学公式

使用 MathJax 生成 SVG，支持行内 `$...$` 和独立的 `$$...$$`，包括 AMS 公式环境和文章内的自定义命令。公式颜色随主题调整；长的独立公式在自己的区域内横向滚动。

```latex
行内公式 $E = mc^2$。

$$
\sum_{i=1}^{n} i = \frac{n(n+1)}{2}
$$
```

字面的美元符号写成 `\$`，代码块和行内代码中的公式语法不会执行。为保留 HTML 安全边界，不启用 TeX 的 HTML、远程加载或链接扩展。公式或图表语法有误时保留原文，便于排查，不中断整篇文章。

### 文件嵌入

资源应位于 `public/` 内。推荐填写网站根路径，也可以使用唯一文件名：

```markdown
![[/assets/posts/my-post/示意图.png]]
![[/assets/posts/my-post/示意图.png|360]]
![[/assets/posts/my-post/示意图.png|360x240]]
![[/assets/posts/my-post/示意图.png|图片替代文字]]
![[/assets/posts/my-post/录音.mp3]]
![[/assets/posts/my-post/演示.mp4]]
![[/assets/posts/my-post/文档.pdf#page=2]]
![[https://example.com/image.png]]
```

支持图片、音频、视频与 PDF；其他附件显示文件链接。PDF 下方保留打开文件的链接，便于不支持内嵌 PDF 的设备阅读。图片尺寸会受正文宽度限制。支持中文和空格文件名。

相对文件名优先在 `public/assets/posts/<文章源文件 ID>/` 中查找，再查找公开资源中的唯一匹配。重名时请填写完整路径；缺失资源会显示提示。磁盘绝对路径、`..`、符号链接和公开目录之外的文件不会被读取。

可独占一行嵌入已发布文章，例如 `![[obsidian-sync]]`、`![[obsidian-sync.md]]` 或 `![[文章标题]]`。存在重名时填写相对于 `src/content/posts/` 的完整路径。不会嵌入草稿或尚未到发布日期的文章；循环或过深的嵌入会停止，并保留原文章链接。句子内部的文章嵌入显示为文章链接。

当前支持整篇文章嵌入；暂不支持文章章节／块引用或反向链接。

### Pele 图表

图表由 Pele 渲染。保留 Mermaid 源语法，围栏语言写 `mermaid` 或 `pele` 均可：

````markdown
```mermaid
flowchart LR
  A[小镇] --> B[文章建筑]
  B --> C[阅读文章]
```

```pele
sequenceDiagram
  访客->>小镇: 选择一栋建筑
  小镇-->>访客: 打开文章
```
````

SVG 颜色随站点主题调整。图表中的图片、外部链接和点击脚本不启用。

### 双向链接与可折叠嵌入

框架支持 Obsidian 风格的文章链接：

```markdown
[[obsidian-sync]]
[[obsidian-sync.md]]
[[文章标题]]
[[obsidian-sync|自定义链接文字]]
```

链接会直接跳转到对应文章。解析会优先匹配当前文章目录下的 ID，再匹配完整 ID、文件名或标题；存在重名时应填写更完整的路径。链接到不存在的文章会保留 `[[...]]` 文字并显示提示，不会生成失效链接；当前文章页展示的是可直接跳转的文章入口。

独占一行的 `![[...]]` 文件或文章嵌入会显示一个轻量标题栏。点击右侧小箭头可以展开或收起全部嵌入内容；文章嵌入标题中的文章名称仍可直接点击跳转。行内嵌入（例如段落中的小图片）保持行内显示，不增加折叠容器。

代码块会在右上角显示语言名称，例如：

````markdown
```python
print('hello')
```
````

会显示 `Python`。未指定语言的代码块不会添加语言标签，未知语言会保留作者填写的名称并使用纯文本高亮。
