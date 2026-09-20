# Town Blog Framework

一个将文章组织成「积木小镇」的静态博客框架：文章会在首页地图中生成建筑，同一系列文章会组成同一栋建筑的不同楼层。

项目基于 **Astro + React + Babylon.js**，适合希望拥有独特视觉入口、又想保留 Markdown 写作体验的个人博客、知识库和作品集站点。

## 特色

- 交互式 3D 积木小镇首页
- Markdown 文章、分类、标签、搜索和系列文章
- 静态构建，适合部署到 GitHub Pages、Cloudflare Pages、Netlify 等平台
- 响应式布局，支持桌面端和移动端
- 日间 / 夜间模式
- 预置国内外常用社交媒体与内容平台的向量 Logo
- 站点信息、作者资料、友链和相关链接集中配置
- 不依赖数据库，文章和图片均可直接放入仓库管理

## 快速开始

```bash
git clone <你的仓库地址>
cd <项目目录>
npm install
npm run dev
```

开发服务器启动后，根据终端输出访问本地地址。

在准备发布前运行完整检查：

```bash
npm run verify
```

生成静态站点：

```bash
npm run build
```

构建结果位于 `dist/`。

## 开始定制

1. 编辑 `src/config/site.ts`，填写网站名称、作者资料和域名。
2. 将自己的 Logo、头像和 favicon 放入 `public/assets/` 并替换占位文件。
3. 复制 `src/content/posts/_article-template.md.example`，创建第一篇文章。
4. 如需展示社交账号，删除 `src/config/site.ts` 中对应链接行开头的 `//`，再填入自己的地址。
5. 如需友链，把配置行解除注释并放入友链头像。
6. 运行 `npm run verify`，确认后部署 `dist/`。

完整字段说明、目录约定、图片资产规则、文章 frontmatter、社交 Logo 选择方式和部署说明，请查看：

➡️ [使用文档：docs/USAGE.md](docs/USAGE.md)

## 预置 Logo

`public/assets/links/` 中已经准备了可直接使用的向量图标，包括 GitHub、GitLab、X、Telegram、Discord、YouTube、Instagram、Threads、TikTok、微博、小红书、知乎、哔哩哔哩、Steam、Twitch、RSS、邮箱等平台。

用户只需要在配置中启用需要的网站，不需要另外准备 Logo；如果目录中没有目标平台，也可以放入自己的 SVG、PNG 或 WebP 并修改 `logo` 路径。

## 目录速览

```text
src/config/site.ts             站点、作者、相关链接与友链配置
src/content/posts/             Markdown 文章
public/assets/links/           预置及自定义相关网站 Logo
public/assets/friends/         友链头像或 Logo
public/assets/posts/           文章图片与附件
public/assets/profile/         网站 Logo 与作者头像
public/favicon.svg             浏览器图标
docs/USAGE.md                  面向使用者的完整文档
```

## 常用命令

```bash
npm run dev              # 启动开发服务器
npm run check            # Astro 与 TypeScript 检查
npm run build            # 构建静态站点
npm run verify           # 完整检查、构建和小镇回归测试
npm run preview          # 预览 dist/ 构建结果
```

## 开源资源说明

小镇环境资源的授权说明位于 `public/assets/brick-town/`。预置网站 Logo 来源、授权与自绘图标说明位于 `public/assets/links/README.md`、`public/assets/links/LICENSE-simple-icons.md` 和 `public/assets/links/DISCLAIMER-simple-icons.md`。
