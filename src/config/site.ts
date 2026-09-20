export interface ProfileLink {
  id: string;
  label: string;
  url: string;
  logo: string;
}

export interface FriendLink {
  id: string;
  nickname: string;
  avatar: string;
  url: string;
  description?: string;
}

interface SiteConfig {
  title: string;
  shortTitle: string;
  tagline: string;
  description: string;
  siteUrl: string;
  logo: string;
  language: string;
  townSeed: string;
  profile: {
    name: string;
    avatar: string;
    headline: string;
    bio: string;
    links: ProfileLink[];
  };
  copyright: string;
}

export const siteConfig: SiteConfig = {
  title: '请填写网站名称', // 必填：浏览器标题、侧边栏品牌名与 Open Graph 站点名称。
  shortTitle: '请填写网站简称', // 必填：顶部导航使用的较短名称，建议 2～8 个字。
  tagline: '请填写网站副标题', // 必填：显示在网站名称下方的短句或英文名。
  description: '请填写网站简介。', // 必填：首页介绍、搜索引擎摘要和社交分享描述。
  siteUrl: 'https://example.com/', // 必填：部署后的完整站点地址，必须以 http:// 或 https:// 开头并建议以 / 结尾。
  logo: '/assets/profile/logo.svg', // 必填：网站 Logo；请替换 public/assets/profile/logo.svg，或填写 public 下其他图片的根路径。
  language: 'zh-CN', // 必填：HTML lang 值，例如 zh-CN、en-US。
  townSeed: 'town-blog-framework-v1', // 可选：小镇布局随机种子；修改后文章建筑的位置与外观会重新排列。
  profile: {
    name: '请填写作者名称', // 必填：个人资料区显示的作者名，也会写入页面 author 元信息。
    avatar: '/assets/profile/avatar.svg', // 必填：作者头像；请替换 public/assets/profile/avatar.svg，或填写其他根路径。
    headline: '请填写一句话介绍', // 必填：作者名称下方的醒目短句。
    bio: '请填写个人简介。', // 必填：个人资料区的简短自我介绍。
    links: [
      // 可选：相关网站。需要展示哪个网站，就删除该行开头的 // 并填写自己的链接；每个网站保持一行。
      // 通用入口
      // { id: 'website', label: '个人网站', url: 'https://你的网址.example.com/', logo: '/assets/links/website.svg' },
      // { id: 'email', label: '电子邮箱', url: 'mailto:你的邮箱@example.com', logo: '/assets/links/email.svg' },
      // { id: 'rss', label: 'RSS', url: '/rss.xml', logo: '/assets/links/rss.svg' },

      // 代码、写作与职业社区
      // { id: 'github', label: 'GitHub', url: 'https://github.com/你的用户名', logo: '/assets/links/github.svg' },
      // { id: 'gitlab', label: 'GitLab', url: 'https://gitlab.com/你的用户名', logo: '/assets/links/gitlab.svg' },
      // { id: 'stackoverflow', label: 'Stack Overflow', url: 'https://stackoverflow.com/users/你的用户ID', logo: '/assets/links/stackoverflow.svg' },
      // { id: 'devto', label: 'DEV Community', url: 'https://dev.to/你的用户名', logo: '/assets/links/devdotto.svg' },
      // { id: 'medium', label: 'Medium', url: 'https://medium.com/@你的用户名', logo: '/assets/links/medium.svg' },
      // { id: 'linkedin', label: 'LinkedIn', url: 'https://www.linkedin.com/in/你的用户名/', logo: '/assets/links/linkedin.svg' },
      // { id: 'notion', label: 'Notion', url: 'https://你的公开页面.notion.site/', logo: '/assets/links/notion.svg' },

      // 国内常用社交与内容平台
      // { id: 'bilibili', label: '哔哩哔哩', url: 'https://space.bilibili.com/你的用户ID', logo: '/assets/links/bilibili.svg' },
      // { id: 'weibo', label: '微博', url: 'https://weibo.com/u/你的用户ID', logo: '/assets/links/sinaweibo.svg' },
      // { id: 'xiaohongshu', label: '小红书', url: 'https://www.xiaohongshu.com/user/profile/你的用户ID', logo: '/assets/links/xiaohongshu.svg' },
      // { id: 'zhihu', label: '知乎', url: 'https://www.zhihu.com/people/你的用户名', logo: '/assets/links/zhihu.svg' },
      // { id: 'douban', label: '豆瓣', url: 'https://www.douban.com/people/你的用户ID/', logo: '/assets/links/douban.svg' },
      // { id: 'qq', label: 'QQ', url: 'https://qm.qq.com/q/你的分享代码', logo: '/assets/links/qq.svg' },
      // { id: 'wechat', label: '微信', url: '请填写可访问的微信介绍或二维码页面链接', logo: '/assets/links/wechat.svg' },
      // { id: 'afdian', label: '爱发电', url: 'https://afdian.com/a/你的用户名', logo: '/assets/links/afdian.svg' },

      // 国际常用社交与即时通讯平台
      // { id: 'x', label: 'X', url: 'https://x.com/你的用户名', logo: '/assets/links/x.svg' },
      // { id: 'telegram', label: 'Telegram', url: 'https://t.me/你的用户名', logo: '/assets/links/telegram.svg' },
      // { id: 'discord', label: 'Discord', url: 'https://discord.gg/你的邀请代码', logo: '/assets/links/discord.svg' },
      // { id: 'instagram', label: 'Instagram', url: 'https://www.instagram.com/你的用户名/', logo: '/assets/links/instagram.svg' },
      // { id: 'threads', label: 'Threads', url: 'https://www.threads.net/@你的用户名', logo: '/assets/links/threads.svg' },
      // { id: 'tiktok', label: 'TikTok', url: 'https://www.tiktok.com/@你的用户名', logo: '/assets/links/tiktok.svg' },
      // { id: 'facebook', label: 'Facebook', url: 'https://www.facebook.com/你的用户名', logo: '/assets/links/facebook.svg' },
      // { id: 'reddit', label: 'Reddit', url: 'https://www.reddit.com/user/你的用户名/', logo: '/assets/links/reddit.svg' },
      // { id: 'mastodon', label: 'Mastodon', url: 'https://你的实例/@你的用户名', logo: '/assets/links/mastodon.svg' },
      // { id: 'bluesky', label: 'Bluesky', url: 'https://bsky.app/profile/你的账号', logo: '/assets/links/bluesky.svg' },
      // { id: 'whatsapp', label: 'WhatsApp', url: 'https://wa.me/你的电话号码', logo: '/assets/links/whatsapp.svg' },
      // { id: 'line', label: 'LINE', url: 'https://line.me/ti/p/你的用户信息', logo: '/assets/links/line.svg' },
      // { id: 'signal', label: 'Signal', url: '请填写你的 Signal 分享链接', logo: '/assets/links/signal.svg' },
      // { id: 'snapchat', label: 'Snapchat', url: 'https://www.snapchat.com/add/你的用户名', logo: '/assets/links/snapchat.svg' },
      // { id: 'tumblr', label: 'Tumblr', url: 'https://你的用户名.tumblr.com/', logo: '/assets/links/tumblr.svg' },
      // { id: 'vk', label: 'VK', url: 'https://vk.com/你的用户名', logo: '/assets/links/vk.svg' },

      // 视频、直播、游戏、音乐与创作平台
      // { id: 'youtube', label: 'YouTube', url: 'https://www.youtube.com/@你的用户名', logo: '/assets/links/youtube.svg' },
      // { id: 'twitch', label: 'Twitch', url: 'https://www.twitch.tv/你的用户名', logo: '/assets/links/twitch.svg' },
      // { id: 'steam', label: 'Steam', url: 'https://steamcommunity.com/id/你的用户名/', logo: '/assets/links/steam.svg' },
      // { id: 'spotify', label: 'Spotify', url: 'https://open.spotify.com/user/你的用户ID', logo: '/assets/links/spotify.svg' },
      // { id: 'soundcloud', label: 'SoundCloud', url: 'https://soundcloud.com/你的用户名', logo: '/assets/links/soundcloud.svg' },
      // { id: 'bandcamp', label: 'Bandcamp', url: 'https://你的用户名.bandcamp.com/', logo: '/assets/links/bandcamp.svg' },
      // { id: 'pixiv', label: 'Pixiv', url: 'https://www.pixiv.net/users/你的用户ID', logo: '/assets/links/pixiv.svg' },
      // { id: 'niconico', label: 'Niconico', url: 'https://www.nicovideo.jp/user/你的用户ID', logo: '/assets/links/niconico.svg' },
      // { id: 'pinterest', label: 'Pinterest', url: 'https://www.pinterest.com/你的用户名/', logo: '/assets/links/pinterest.svg' },
      // { id: 'patreon', label: 'Patreon', url: 'https://www.patreon.com/你的用户名', logo: '/assets/links/patreon.svg' },
      // { id: 'kofi', label: 'Ko-fi', url: 'https://ko-fi.com/你的用户名', logo: '/assets/links/kofi.svg' },

      // 也可以自行把 SVG、PNG 或 WebP 放入 public/assets/links/，再按相同格式添加一行配置。
    ],
  },
  copyright: '© 请填写版权所有者', // 必填：侧边栏底部显示的版权文字，可包含年份。
};

export const friendLinks: FriendLink[] = [
  // 可选：友链。每位友邻单独占一行；启用时删除行首 //，并把头像或站点 Logo 放入 public/assets/friends/。
  // { id: 'friend-id', nickname: '友邻名称', avatar: '/assets/friends/friend-id.png', url: 'https://friend.example.com/', description: '可选的友邻简介' },
];
