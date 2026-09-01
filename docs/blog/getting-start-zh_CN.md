> 📖 [English README](../README.md)

## 这是一个自己闲暇编写的一个博客/简单文档站点
### 如果想查看该项目的效果, 请访问:
- [jadren blog (https://blog.jadren.me)](https://blog.jadren.me)


## 关于创建或修改文章

所有已验证账号都可以访问博客域名下的 `/editor` 并提交 pending 修改。管理员权限通过 PostgreSQL 设置：

```sql
UPDATE user_main SET is_admin = TRUE WHERE user_id = '你的用户 UUID';
```

编辑器支持 Markdown 实时预览。普通用户和管理员的保存操作都会写入 pending；管理员在 `/admin` 审核批准后，才会用事务同步正式文章与标签。旧版仓库 Markdown 可通过 `bun run blog:import` 一次性导入。

管理员也可以填写理由后驳回并删除 pending。系统会保存驳回与邮件投递审计记录，并向提交者的注册邮箱发送通知。

Pending 会分别记录作者、所有者和最后编辑用户。普通用户只能查看和修改自己拥有的 pending；管理员可以修改全部 pending，或 Fork 一份归自己所有、但保留原 `author_id` 的副本。批准发布时可以附带留言，系统会通知 `author_id` 对应邮箱，并更新正式文章的贡献者记录。

### 文章格式

在 `content/posts/zh/`（中文）或 `content/posts/en/`（英文）目录下创建 `.md` 文件，文件顶部需要包含如下 frontmatter：

```markdown
---
title: 你的文章标题
date: 2026-06-16T00:00:00.000Z
description: 文章简介，留空会自动把标题变成描述
tags: [tag1, tag2]
---

在这里书写你的文章正文（Markdown 格式）...
```

- `title` — 文章标题
- `date` — 发布日期（ISO 格式），如果留空，会把第一次被访问的日期变更为文章日期
- `description` — 文章简介（可选），留空会自动把标题变成描述
- `tags` — 文章标签（可选）

上面的 frontmatter 格式仅供旧文章导入脚本使用；导入完成后 PostgreSQL 是文章的唯一数据源。

## 关于使用此项目作为自己的博客或者文档站点
### 效果预览

![主页](./pics/main-page-cn.png)

![文章页面（中文）](./pics/markdown-test-cn.png)

![文章页面（暗色模式）](./pics/markdown-test-dark-cn.png)

### Step1:克隆项目 安装依赖 测试运行
> 本项目使用 Bun 运行，并使用 PostgreSQL 保存文章、草稿、标签、浏览量及工具站数据。请先配置数据库环境变量并运行 `bun run db:setup`。

```shell
# 克隆该项目
git clone https://github.com/jadrens/jadren_web_suit.git
```


```shell
# 确保你安装了bun
# 切换目录并安装依赖
cd jadren_web_suit
bun install
```
```shell
# 测试运行
bun --bun dev
```
打开 **http://localhost:3000** 进行测试



## Step 2:修改配置
- 修改本项目的 ```/src/var/config.ts```
```typescript
export const SITE_CONFIG = {
  // 你的网站域名 这里用来生成sitemap.xml,有助于搜索引擎对你网站的索引
  baseUrl: "https://blog.jadren.me",
  // 网站标题
  siteName: "jadren blog",
  // 给搜索引擎看的网站介绍
  description: "A blog with markdown and LaTeX support",
  // 如果你要把你的网站开源可编辑, 这里填入你的github项目地址
  githubRepo: "https://github.com/jadrens/jadren_web_suit",
  githubBranch: "main",
  // 是否在网站底部显示你的github图标
  githubClipEnabled: true,
  // 是否开启github编辑按钮
  githubEditEnabled: true,
} as const;
```
- 修改图标
修改本项目的```/public/avatar.png```这就是网站的首页头像<br>
修改```/src/app/icon.png```这是网站的小图标(favicon.ico)

- 修改联系方式
修改 ```/src/var/contact.ts``` 选择启用哪些联系方式，并修改 url

```typescript
export const CONTACT_CONFIG = {
  github: {
    enabled: true,                              // 是否启用
    url: "https://github.com/jadrens",          // 你的 GitHub 主页
    username: "jadrens",
    color: "#181717",
  },
  youtube: {
    enabled: true,
    url: "https://www.youtube.com/@LoongRens",
    username: "@LoongRens",
    color: "#FF0000",
  },
  bilibili: {
    enabled: true,
    url: "https://space.bilibili.com/435996008",
    username: "dragonren",
    color: "#00A1D6",
  },
  telegram: {
    enabled: true,
    url: "https://t.me/dragonrens",
    username: "@dragonrens",
    color: "#26A5E4",
  },
  email: {
    enabled: true,
    address: "jaden@jadren.moe",
  },
  ...
} as const;
```

将 `enabled` 设为 `false` 即可隐藏对应的联系方式。

- 添加你的页面
-- 个人简介
修改 ```/content/about/zh.md``` 和 ```/content/about/en.md```（分别是中英文）
-- 文章
通过博客站 `/editor` 创建和修改；`content/posts` 只作为旧文章的一次性导入源。

## Step 3:部署


```shell
# 构建
bun --bun run build
# 运行
bun --bun run start -p 3000
```
- 该应用默认运行在3000端口,或者修改```-p```来更改,不支持tls,请用nginx等反向代理工具代理。可参考即用型配置 [`docs/nginx-example.conf`](nginx-example.conf)。

### 可选：使用 systemd 管理服务

```ini
# /etc/systemd/system/blog.service
[Unit]
Description=Blog Service
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/dra_blog
ExecStart=/usr/bin/bun --bun run start -p 3000
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

```shell
# 启用服务
sudo systemctl enable --now blog.service
```


## 关于 robots.txt 和 sitemap.xml

### robots.txt

默认允许所有爬虫，可以修改 `/src/app/robots.ts` 的 `rules` 来更改：

```typescript
// /src/app/robots.ts
import { MetadataRoute } from "next";
import { SITE_CONFIG } from "@/var/config";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",     // 允许所有爬虫
      allow: "/",          // 允许所有路径
      // disallow: "/admin/",  // 禁止某些路径
    },
    sitemap: `${SITE_CONFIG.baseUrl}/sitemap.xml`,
  };
}
```

### sitemap.xml

默认根据 `/src/var/config.ts` 中的 `SITE_CONFIG` 索引所有页面，包括：

- **主页** — `baseUrl`
- **关于页面** — `baseUrl/about`
- **博客列表** — `baseUrl/blog/{locale}`
- **博客文章** — `baseUrl/blog/{locale}/{slug}`

如需修改 sitemap 生成逻辑，编辑 `/src/app/sitemap.ts`：

```typescript
// /src/app/sitemap.ts
import { MetadataRoute } from "next";
import { getAllPosts, Locale } from "@/lib/posts";
import { SITE_CONFIG } from "@/var/config";

const locales: Locale[] = ["en", "zh"];

export default function sitemap(): MetadataRoute.Sitemap {
  const allPages: MetadataRoute.Sitemap = [
    {
      url: SITE_CONFIG.baseUrl,
      lastModified: new Date().toISOString().split("T")[0],
      changeFrequency: "weekly",
      priority: 1,
    },
    // ... 关于页面、博客列表、博客文章
  ];
  return allPages;
}
```

## 开源许可证

```
MIT License

Copyright (c) 2026 Jadrens

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
