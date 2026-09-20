# 相关网站图标

该目录包含可直接用于 `src/config/site.ts` 的预制向量图标。大部分图标来自 Simple Icons（CC0 1.0），并补充了本框架自绘的 Email、LinkedIn 和 Website 图标。商标与品牌使用说明请同时参阅 `DISCLAIMER-simple-icons.md`。

使用方式：

```ts
{ id: 'github', label: 'GitHub', url: 'https://github.com/your-name', logo: '/assets/links/github.svg' }
```

如果目录中没有需要的网站，可以将自己的 SVG、PNG 或 WebP 放入本目录，并把 `logo` 改成对应路径。
