# Jadren Web Suit

[中文](#中文) · [English](#english)

一个由 Next.js 驱动的一体化个人网站：在同一域名和账号体系下提供双语博客、用户投稿与审核、在线工具、英语学习以及提醒服务。

An integrated personal web platform powered by Next.js, combining a bilingual blog, community publishing, online utilities, English-learning tools, and reminders under one domain and account system.

---

## 中文

### 项目介绍

Jadren Web Suit 不只是一个静态博客。它将内容发布、实用工具和用户服务整合为一个完整的 Web 应用：访客可以阅读中英文文章和使用浏览器工具；已验证用户可以提交文章、保存个人数据、创建短链接与邮件提醒；管理员则可以在独立审核流程中批准、修改或驳回投稿。

项目采用单域名设计。主页位于 `/`，博客、工具、账号和设置页面通过 `/blog`、`/tools`、`/login`、`/settings` 等路径访问，内部由 Next.js rewrites 映射到各站点模块。

### 主要功能

- **双语博客**：中英文文章、标签、搜索、浏览量、上一篇/下一篇、目录与阅读进度。
- **Markdown 与 HTML**：支持 GFM、LaTeX/KaTeX、代码高亮和常规 HTML。
- **安全投稿**：HTML 经过白名单清洗；脚本、嵌入页面、表单、事件属性和危险 URL 不会进入页面。
- **投稿与审核**：所有已验证账号均可创建或修改文章；内容先进入 pending，只有管理员可以正式发布。
- **贡献记录**：分别记录文章作者、草稿所有者、最后编辑者和已发布贡献者。
- **审核通知**：管理员可附言批准，也可填写理由驳回或删除；邮件投递结果保留在审计日志中。
- **统一账号**：注册、登录、邮箱验证、访问令牌刷新和管理员权限。
- **在线工具**：Base64、颜色转换、DNS、DNS 泄漏检测、IP 信息、二维码、短链接和邮件提醒。
- **英语学习**：语法润色、AI 对话、单词练习和造句练习；LLM 配置默认保存在用户浏览器中。
- **可选 LLM 云备份**：可用独立密码在浏览器端加密后上传，并在其他设备下载恢复；由于备份包含 API Key，此功能不推荐使用，也无法承诺绝对安全。
- **界面体验**：中英文界面、深色/浅色主题和响应式布局。

### 技术栈

| 类别 | 技术 |
| --- | --- |
| Web 框架 | Next.js 16（App Router） |
| UI | React 19、MUI 9、Emotion、Tailwind CSS 4 |
| 语言与运行时 | TypeScript、Bun |
| 数据库 | PostgreSQL |
| 内容渲染 | react-markdown、remark-gfm、KaTeX、rehype-highlight |
| HTML 安全 | rehype-raw + rehype-sanitize 白名单 |
| 认证与邮件 | bcrypt、JWT（jose）、Resend |
| 动画 | Framer Motion、Matter.js |

### 快速开始

需要 Bun 1.4 或兼容版本，以及 PostgreSQL。

```bash
git clone https://github.com/jadrens/jadren_web_suit.git
cd jadren_web_suit/main
bun install
```

创建 `.env.local`：

```dotenv
DATABASE_URL=postgresql://user:password@127.0.0.1:5432/jadren
POSTGRES_SSL=false

# 至少 32 个字符
JWT_SECRET=replace-with-a-long-random-secret

# 邮箱验证、审核通知和提醒
RESEND_API_KEY=re_xxxxxxxxx
AUTH_FROM_EMAIL=Jadren <account@example.com>
REMINDER_FROM_EMAIL=Jadren Reminder <reminder@example.com>

# 仅 DNS 管理器/泄漏检测后端需要
DNS_MANAGER_TOKEN=optional-token
```

也可以不用 `DATABASE_URL`，改为分别设置 `POSTGRES_HOST`、`POSTGRES_PORT`、`POSTGRES_USER`、`POSTGRES_PASSWORD` 和 `POSTGRES_DB`。生产数据库是否启用 TLS 请通过 `POSTGRES_SSL` 按实际环境配置。

初始化并启动：

```bash
bun run db:setup
bun run dev
```

默认访问 `http://localhost:3000`。如需使用预设本地域名，可在 `/etc/hosts` 添加 `127.0.0.1 jadren.debug`，然后访问 `http://jadren.debug:3000`。

### 博客投稿与审核

1. 用户注册并验证邮箱。
2. 用户在 `/editor` 创建文章或修改现有文章。
3. 保存内容进入 `blog_post_pending`，不会直接影响公开文章。
4. 管理员在 `/admin` 编辑、Fork、批准或驳回投稿。
5. 批准操作通过数据库事务同步正文和标签，然后更新贡献者并发送通知。

授予管理员权限：

```sql
UPDATE user_main SET is_admin = TRUE WHERE user_id = '用户 UUID';
```

PostgreSQL 是公开文章的唯一数据源。`content/posts/{zh,en}` 只保留为旧内容迁移源，可执行一次：

```bash
bun run blog:import
```

### HTML 安全策略

文章可以使用段落、表格、折叠内容、图片和文本格式等普通 HTML。投稿预览和公开文章使用同一套白名单渲染流程。

以下内容会被移除：

- `script`、`iframe`、`frame`、`object`、`embed`、`applet`
- `form`、`input`、`button`、`select`、`textarea`
- `style`、`link`、`meta`、`base`
- `onclick`、`onerror` 等事件属性
- `javascript:` 等危险 URL 协议

清洗发生在 KaTeX 和代码高亮之前，用户内容无法利用它们生成的内部标记绕过白名单。

### LLM 设置云备份

LLM Provider、模型和 API Key 默认只保存在当前浏览器。登录已验证账号后，设置页也提供手动上传和下载功能，但**不推荐使用**：任何包含 API Key 的云端数据都存在风险，没有系统能够完全保证安全。

上传前，浏览器使用用户单独输入的备份密码，通过 PBKDF2-SHA-256 派生密钥并以 AES-256-GCM 加密。服务器只保存密文、salt 和 IV，不接收或保存备份密码。下载后也只在浏览器中解密。备份密码无法找回，遗失后云端备份无法恢复；下载操作会替换当前浏览器中的 LLM 设置。

### 常用命令

| 命令 | 用途 |
| --- | --- |
| `bun run dev` | 启动开发服务器 |
| `bun run build` | 创建生产构建 |
| `bun run start` | 启动生产服务器 |
| `bun run lint` | 运行 ESLint |
| `bun test` | 运行测试 |
| `bun run db:setup` | 应用 PostgreSQL schema |
| `bun run blog:import` | 一次性导入旧 Markdown 文章 |
| `bun run ncee:build` | 构建高考词汇数据 |
| `bun run reminder:dispatch` | 派发到期提醒 |
| `bun run deploy:run` | 执行 `scripts/deploy` 中的部署任务 |

### 项目结构

```text
main/
├── content/                  # About 内容和旧文章导入源
├── database/                 # PostgreSQL schema 与初始化脚本
├── deploy/                   # systemd 和 Nginx 示例
├── docs/                     # 架构、博客与 API 文档
├── public/shared/            # 公共字体、图标、头像和背景
├── scripts/                  # 导入、数据构建、提醒和部署任务
└── src/
    ├── app/sites/blog/       # 博客、编辑器、后台和 API
    ├── app/sites/main/       # 门户、账号、设置和 SEO 路由
    ├── app/sites/tool/       # 在线工具、英语学习和 API
    ├── shared/               # 认证、数据库、邮件、i18n 和共享组件
    └── sites/                # 各站点组件、配置、样式和 hooks
```

详细设计见 [`docs/blog/architecture.md`](docs/blog/architecture.md)，接口说明见 [`docs/tool/auth-api.md`](docs/tool/auth-api.md) 和 [`docs/tool/client-api.md`](docs/tool/client-api.md)。

### 部署

```bash
bun run build
bun run start -- -p 3000
```

应用本身不终止 TLS，生产环境建议使用反向代理。Nginx 示例位于 [`deploy/nginx.conf.example`](deploy/nginx.conf.example)，systemd 单元位于 `deploy/`。

GitHub Actions 会构建应用、同步服务器、应用数据库 schema、依次运行 `scripts/deploy/` 任务、安装服务单元并健康检查。部署默认关闭；设置仓库变量 `DEPLOY_ENABLED=true` 后，推送到 `run` 分支才会部署生产环境。部署任务必须可重复执行，最终数据库状态应始终保留在 `database/schema.sql`。

### 许可证

项目采用 [MIT License](LICENSE)。第三方数据和资源的许可证见 [`THIRD_PARTY_LICENSES`](THIRD_PARTY_LICENSES)。

---

## English

### Overview

Jadren Web Suit is more than a static blog. It combines publishing, practical utilities, and user services in one application. Visitors can read bilingual articles and use browser tools; verified users can submit articles, retain personal learning data, create short links, and schedule email reminders; administrators review and publish contributions through a dedicated moderation workflow.

The application uses a single-origin design. The portal is served at `/`, with the blog, tools, accounts, and settings under paths such as `/blog`, `/tools`, `/login`, and `/settings`. Next.js rewrites map these public URLs to internal site modules.

### Highlights

- **Bilingual blog:** Chinese and English posts, tags, search, view counts, adjacent-post navigation, a table of contents, and reading progress.
- **Markdown and HTML:** GFM, LaTeX/KaTeX, syntax highlighting, and regular HTML.
- **Safe submissions:** Raw HTML is sanitized with an allowlist; scripts, embedded pages, forms, event handlers, and dangerous URLs do not reach the page.
- **Community publishing:** Every verified account can submit changes, which stay pending until approved by an administrator.
- **Contribution history:** Authors, draft owners, last editors, and published contributors are tracked independently.
- **Audited moderation:** Approval messages and rejection/deletion reasons are emailed, with delivery results retained in an audit log.
- **Shared accounts:** Registration, sign-in, email verification, token refresh, and administrator permissions.
- **Online utilities:** Base64, colour conversion, DNS, DNS leak testing, IP information, QR codes, short links, and reminders.
- **English learning:** Grammar polishing, AI chat, vocabulary drills, and sentence practice; LLM profiles stay in the user's browser by default.
- **Optional LLM cloud backup:** Encrypt settings in the browser with a separate passphrase, upload them, and restore them on another device. Because the backup contains API keys, this feature is not recommended and cannot promise absolute security.
- **Interface:** Chinese and English UI, dark/light themes, and responsive layouts.

### Technology

| Area | Technology |
| --- | --- |
| Web framework | Next.js 16 (App Router) |
| UI | React 19, MUI 9, Emotion, Tailwind CSS 4 |
| Language and runtime | TypeScript and Bun |
| Database | PostgreSQL |
| Content | react-markdown, remark-gfm, KaTeX, rehype-highlight |
| HTML security | rehype-raw with a rehype-sanitize allowlist |
| Authentication and email | bcrypt, JWT (jose), Resend |
| Animation | Framer Motion and Matter.js |

### Quick start

Bun 1.4 or a compatible release and PostgreSQL are required.

```bash
git clone https://github.com/jadrens/jadren_web_suit.git
cd jadren_web_suit/main
bun install
```

Create `.env.local`:

```dotenv
DATABASE_URL=postgresql://user:password@127.0.0.1:5432/jadren
POSTGRES_SSL=false

# At least 32 characters
JWT_SECRET=replace-with-a-long-random-secret

# Verification, moderation, and reminder email
RESEND_API_KEY=re_xxxxxxxxx
AUTH_FROM_EMAIL=Jadren <account@example.com>
REMINDER_FROM_EMAIL=Jadren Reminder <reminder@example.com>

# Only required by the DNS manager/leak backend
DNS_MANAGER_TOKEN=optional-token
```

Instead of `DATABASE_URL`, set `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` separately. Configure `POSTGRES_SSL` for the production database environment.

Initialize and start development:

```bash
bun run db:setup
bun run dev
```

Open `http://localhost:3000`. For the configured local domain, add `127.0.0.1 jadren.debug` to `/etc/hosts`, then open `http://jadren.debug:3000`.

### Article submission and moderation

1. A user registers and verifies their email address.
2. The user creates or edits an article at `/editor`.
3. Saves go to `blog_post_pending` without changing the public article.
4. An administrator reviews, edits, forks, approves, or rejects it at `/admin`.
5. Approval synchronizes content and tags in a transaction, updates contributors, and sends a notification.

Grant administrator access with PostgreSQL:

```sql
UPDATE user_main SET is_admin = TRUE WHERE user_id = 'user UUID';
```

PostgreSQL is the source of truth for published articles. `content/posts/{zh,en}` is retained only as a legacy migration source:

```bash
bun run blog:import
```

### HTML security policy

Articles may use ordinary HTML such as paragraphs, tables, disclosure widgets, images, and text formatting. Draft previews and public articles share the same allowlist pipeline.

The sanitizer removes:

- `script`, `iframe`, `frame`, `object`, `embed`, and `applet`
- `form`, `input`, `button`, `select`, and `textarea`
- `style`, `link`, `meta`, and `base`
- Event attributes such as `onclick` and `onerror`
- Dangerous URL protocols such as `javascript:`

Sanitization runs before KaTeX and syntax highlighting, preventing user content from abusing their generated markup to bypass the allowlist.

### LLM settings cloud backup

LLM providers, models, and API keys remain in the current browser by default. After signing in with a verified account, the settings page offers manual upload and download actions. This feature is **not recommended**: cloud data containing API keys always carries risk, and no system can guarantee complete security.

Before upload, the browser derives a key from a separate backup passphrase with PBKDF2-SHA-256 and encrypts the settings using AES-256-GCM. The server stores only ciphertext, salt, and IV; it never receives or stores the passphrase. Decryption also happens only in the browser. The passphrase cannot be recovered, and downloading replaces the LLM settings currently stored in that browser.

### Commands

| Command | Purpose |
| --- | --- |
| `bun run dev` | Start development |
| `bun run build` | Create a production build |
| `bun run start` | Start production |
| `bun run lint` | Run ESLint |
| `bun test` | Run tests |
| `bun run db:setup` | Apply the PostgreSQL schema |
| `bun run blog:import` | Import legacy Markdown once |
| `bun run ncee:build` | Build NCEE vocabulary data |
| `bun run reminder:dispatch` | Dispatch due reminders |
| `bun run deploy:run` | Run tasks under `scripts/deploy` |

### Project layout

```text
main/
├── content/                  # About content and legacy article imports
├── database/                 # PostgreSQL schema and setup
├── deploy/                   # systemd and Nginx examples
├── docs/                     # Architecture, blog, and API documentation
├── public/shared/            # Shared fonts, icons, avatar, and backgrounds
├── scripts/                  # Import, data, reminder, and deployment jobs
└── src/
    ├── app/sites/blog/       # Blog, editor, admin UI, and APIs
    ├── app/sites/main/       # Portal, accounts, settings, and SEO routes
    ├── app/sites/tool/       # Utilities, English learning, and APIs
    ├── shared/               # Auth, database, email, i18n, and shared UI
    └── sites/                # Per-site components, config, styles, and hooks
```

See [`docs/blog/architecture.md`](docs/blog/architecture.md) for design details and [`docs/tool/auth-api.md`](docs/tool/auth-api.md) / [`docs/tool/client-api.md`](docs/tool/client-api.md) for API documentation.

### Deployment

```bash
bun run build
bun run start -- -p 3000
```

The application does not terminate TLS. Use a reverse proxy in production. An Nginx example is available at [`deploy/nginx.conf.example`](deploy/nginx.conf.example), with systemd units under `deploy/`.

GitHub Actions builds the application, synchronizes the server, applies the database schema, runs `scripts/deploy/` tasks in order, installs service units, and performs a health check. Deployment is disabled by default. Set the repository variable `DEPLOY_ENABLED=true`; pushes to `run` will then deploy production. Tasks must be safe to retry, and `database/schema.sql` must always describe the final database state.

### License

Released under the [MIT License](LICENSE). Third-party data and asset licenses are listed in [`THIRD_PARTY_LICENSES`](THIRD_PARTY_LICENSES).
