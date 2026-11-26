# 积木小镇博客使用指南

文章会生成小镇建筑，同一系列的文章共用建筑的不同楼层；正文、档案和 RSS 在构建时生成。

本仓库是可自行配置的博客框架；站点名称、作者资料和图片是占位内容，默认没有文章。首次使用请填写 `src/config/site.ts`，替换 `public/assets/profile/` 的占位图片。

## 快速开始

需要 Node.js 22.12.0 或更高版本。在仓库根目录运行：

```bash
npm install
npm run dev
```

按终端给出的地址打开网站。完成修改后运行 `npm run verify`；部署前运行 `npm run build`，静态结果在 `dist/`。可用 `npm run preview` 检查构建后的页面。开发服务器的加载时间不代表生产构建的表现。

## 站点资料与图片

在 `src/config/site.ts` 中维护网站名称、简介、正式网址、作者资料和链接。其中 `siteUrl` 必须是含 `https://` 或 `http://` 的完整地址，供 canonical、分享卡片、RSS 和正式域名统计使用。`townSeed` 控制建筑布局；已发布内容保持它不变，可避免重排。

`public/` 内的文件从站点根路径引用。例如 `public/assets/posts/my-post/photo.webp` 写成 `/assets/posts/my-post/photo.webp`。常用目录：

| 路径 | 内容 |
| --- | --- |
| `public/assets/profile/` | 站点 Logo、作者头像 |
| `public/assets/links/` | 相关网站图标（预置图标见该目录） |
| `public/assets/friends/` | 友链头像、站点 Logo |
| `public/assets/posts/<文章源文件 ID>/` | 封面、正文图片、附件 |

替换图片后若扩展名改变，记得同步修改 `site.ts` 或文章中的路径。浏览器图标为 `public/favicon.svg`，由 `src/layouts/TownAppPage.astro` 引用。

### 相关网站与友链

`siteConfig.profile.links` 显示作者的相关网站。模板中的预置平台以注释形式列在 `site.ts`；选中平台，取消注释并修改 `url` 即可。自定义平台也可添加一行：

```ts
{ id: 'github', label: 'GitHub', url: 'https://github.com/your-name', logo: '/assets/links/github.svg' }
```

`id` 要唯一且稳定；`label` 用作可读名称，`logo` 对应 `public/` 中的图标。邮箱可用 `mailto:`，RSS 可用 `/rss.xml`。预置图标的来源与授权见 `public/assets/links/LICENSE-simple-icons.md`。

在 `site.ts` 的 `friendLinks` 中添加友邻；不需要友链时可保持空数组：

```ts
{ id: 'friend-id', nickname: '友邻名称', avatar: '/assets/friends/friend-id.png', url: 'https://friend.example.com/', description: '可选简介' }
```

`id`、`nickname`、`avatar`、`url` 必填，`description` 可省略。新增友邻会在小镇外围生成小屋；桌面端点击小屋或侧栏友链，会先聚焦小屋，再在新标签页打开对方网站。手机及启用「减少动态效果」时直接打开；若弹窗被拦截，页面会提供原链接。

## 写作与发布文章

文章放在 `src/content/posts/`，可按子目录整理。在仓库根目录运行：

```bash
npm run new -- "My New Post"
```

命令创建 `my-new-post.md` 草稿，自动填写 `townId: post-my-new-post`、当前本地日期和 `draft: true`，不会覆盖同名文件。草稿中的标题、摘要、分类、标签占位项与封面路径需填写或删除，不需要封面时删除 `cover` 和 `coverAlt`。也可复制 `src/content/posts/_article-template.md.example`，改名为 `.md` 后手动填写。

| Frontmatter | 用途 |
| --- | --- |
| `townId` | 必填，全站唯一的永久 ID；同时用于文章 URL、建筑和评论归属，发布后保持稳定 |
| `title`、`description`、`category`、`date` | 必填，分别是标题、摘要、单一分类和发布时间；`date` 建议含时区，如 `2026-09-20T12:00:00+08:00` |
| `tags` | 可选，字符串数组；无标签时写 `[]` 或省略 |
| `draft` | `true` 不发布；省略或 `false` 才会进入发布候选 |
| `series`、`seriesIndex` | 可选，必须一起填写；同一系列的序号从 `0` 开始且不能重复 |
| `cover`、`coverAlt` | 可选；封面使用 `/` 开头的站点路径，建议填写替代文字 |
| `updatedAt` | 可选，最后更新时间 |
| `featured` | 可选的保留字段，当前主题不按它排序 |

草稿也会接受字段和资源校验。发布时将 `draft` 改为 `false`；未来日期的文章要等到**重新构建**且日期已到，才会出现在网站和 RSS 中。普通文章一般各有建筑，同系列文章共用一栋；修改 `townId`、系列归属或 `townSeed` 会影响文章映射。

正文从 `##` 开始即可；页面标题取自 `title`，正文标题生成目录。资源示例：

```md
![街景](/assets/posts/my-new-post/street.webp)
[下载资料](/assets/posts/my-new-post/files/source.zip)
```

## 正文语法

支持标准 Markdown、表格、单换行、`~~删除线~~`、`==高亮==`、任务列表和带语言名称的围栏代码块。代码块由 Shiki 在构建时高亮；任务框仅用于展示，不可勾选。

### 提示框与公式

提示框使用引用语法，颜色可选 `red`、`blue`、`yellow`、`green`、`purple`、`gray`（兼容 `gary`、`grey`）。在颜色后加 `+` 或 `-` 可设为可折叠，分别默认展开或收起；没有标记时为普通提示框。

```md
> [!blue] 阅读提示
> 这里是内容。

> [!green]- 先收起
> 点击标题可以展开。
```

行内公式用 `$E=mc^2$`，独立公式用 `$$...$$`。字面美元符号写作 `\$`。公式在构建时渲染；语法错误会保留原文以便排查。

### 内容引用与嵌入

`[[...]]` 创建站内引用；`![[...]]` 嵌入文件或文章。可使用文章 ID、唯一文件名、标题或完整路径；重名时使用更完整的路径。

```md
[[my-post|自定义链接文字]]
[[my-post#安装步骤]]
[[my-post#^example-block]]
[[#本篇标题]]
[[/assets/posts/my-post/guide.pdf]]

![[my-post]]
![[my-post#安装步骤]]
![[/assets/posts/my-post/photo.webp|360]]
![[/assets/posts/my-post/demo.mp4]]
![[/assets/posts/my-post/guide.pdf#page=2]]
```

`#标题` 可定位章节，重复标题可附上上级标题；`#^标识` 定位内容块。段落末尾写 `^example-block`，即可给该段命名；其他完整块也可在后方空一行单独写标识。块标识由英文字母、数字和短横线组成，文章内不可重复。引用会定位目标并展开必要的折叠内容；浏览器返回时恢复阅读位置。缺失引用会显示提示。

独占一行的嵌入可以折叠，文章嵌入支持整篇、单个章节或内容块。图片、音频、视频和 PDF 可直接嵌入，其他附件显示链接；图片可用 `|360` 或 `|360x240` 指定尺寸。相对文件名先在当前文章的 `public/assets/posts/<文章源文件 ID>/` 查找。只读取公开目录中的资源；循环引用或过深嵌入会终止，并保留跳转入口。

### 图表

使用 `mermaid` 或 `pele` 围栏编写图表，构建时由 Pele 输出静态 SVG：

````md
```mermaid
flowchart LR
  A[小镇] --> B[文章]
```
````

图表与公式的渲染在构建时完成；读者浏览器不需要下载相应引擎。图表中的脚本与外部点击链接不执行。

## 小镇、关于页与阅读入口

顶部季节菜单可选择春夏秋冬，或按设备本地月份使用「当季」（北半球气象季节）。手动选择仅在当前页面会话保持，刷新后恢复「当季」；换季不改变文章布局。降水每 15 分钟按时间段和站点种子确定，概率为 18%；冬季显示雪，其余季节显示雨。昼夜模式独立于季节。离屏、后台及「减少动态效果」模式会降低绘制开销。

小镇建筑、侧栏列表、档案、搜索均可进入文章。从小镇进入文章时会运镜；浏览器返回恢复运镜前的视角。中心风车、侧栏头像及「关于」入口通往 `/about/`。移动端点击建筑先显示预览，确认后运镜进入；「减少动态效果」偏好会跳过运镜。关于页文案在 `src/config/about.ts`：模板中的 `introduction`、卡片标题和段落默认留空，请按需填写；`sections` 支持可选链接。共用的昵称、头像、相关网站链接仍在 `site.ts`。

## 评论与 RSS

### 可选评论（Giscus）

框架默认关闭评论。启用时先准备公开 GitHub 仓库、开启 Discussions，并在 [Giscus 配置页](https://giscus.app/zh-CN) 安装应用、选择仓库和分类。将页面生成的 `repo`、`repoId`、`category`、`categoryId` 填入 `src/config/comments.ts`，取消 `enabled: true` 的注释，重新构建部署。这些是公开标识，无需 GitHub Token；关闭该选项不会删除已有讨论。

每篇文章按 `townId` 关联讨论。评论区在靠近文章底部时才加载，支持日夜主题，正文阅读进度不含评论；首次提交评论时才会创建讨论。启用后应手动检查加载、登录和主题切换。

### 全文 RSS

`/rss.xml` 默认启用，侧栏有订阅入口；站点标题、简介、文章的绝对链接均取自 `siteUrl`。它只收录已发布且发布时间不晚于构建时间的文章。提示框与文章嵌入在订阅中展开，任务框转为文字标记；公式和图表生成 `rss-assets/` 中的图片，音视频与附件给出链接。不同阅读器可能过滤样式或图片；精简 Linux 环境应安装所用语言的字体，避免图表文字缺失。部署时上传完整 `dist/`，包括 RSS 文件和生成的资源。可用 `npm run verify:rss` 检查构建结果。

## 访问统计与部署

访问统计由[杜老师说 · 不蒜子统计平台](https://bsz.dusays.com/)提供；关于页展示全站 PV、UV，文章元信息展示单篇 UV。只有 `siteUrl` 指向的正式域名计数，本地和预览环境不计数；服务不可用时不阻断阅读。UV 是服务方估计的访客数，跨设备或清除浏览器存储后不保证去重。

静态页面可以部署到常见静态托管平台。Vercel 部署时请同时保留根目录 `api/`，用于同域 `/api/views` 统计代理；只上传 `dist/` 将失去该代理，前端会尝试直连第三方接口，是否可达取决于读者网络。其他静态托管平台同样使用直连方式。无需单独部署数据库。

部署前确认 `siteUrl`、图标、文章草稿状态与 `dist/` 中的 RSS 和图片资源。构建后修改文章或等待未来文章到期，都需要重新构建和部署。

## 常用文件与检查

| 路径 | 用途 |
| --- | --- |
| `src/config/site.ts`、`src/config/about.ts`、`src/config/comments.ts` | 站点、关于页、评论 |
| `src/content/posts/`、`src/content.config.ts` | 文章及字段校验 |
| `public/assets/` | 图片和附件 |
| `src/data/`、`src/scene/brick-town/` | 小镇布局和 3D 场景 |
| `src/styles/global.css` | 全站样式 |

```bash
npm run check           # 类型与 Astro 检查
npm run verify:content  # 文章 ID 和资源引用
npm run verify:markdown # 富 Markdown 和嵌入
npm run verify:features # 地块、友链与统计等功能
npm run verify          # 完整检查（含构建）
npm run build           # 生成 dist/
npm run preview         # 预览生产构建
```

框架的 `npm run verify` 运行类型检查、构建、内容、季节、Markdown、RSS 与功能验证。浏览器和真机上的动画与加载体验需要另行使用 `npm run build && npm run preview` 检查。
