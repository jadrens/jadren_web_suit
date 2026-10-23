# Jadren Web Suit

[English](README.md) · 简体中文

网站：[jadren.me](https://jadren.me)

一个由 Next.js 驱动的一体化个人网站：在同一域名和账号体系下提供双语博客、用户投稿与审核、在线工具、英语学习以及提醒服务。

## 项目介绍

Jadren Web Suit 不只是一个静态博客。它将内容发布、实用工具和用户服务整合为一个完整的 Web 应用：访客可以阅读中英文文章和使用浏览器工具；已验证用户可以提交文章、保存个人数据、创建短链接与邮件提醒；管理员则可以在独立审核流程中批准、修改或驳回投稿。

项目采用单域名设计。主页位于 `/`，博客、工具、账号和设置页面通过 `/blog`、`/tools`、`/login`、`/settings` 等路径访问，内部由 Next.js rewrites 映射到各站点模块。

## 主要功能

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

## 技术栈

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

## 快速开始

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

词汇练习的服务端发音兜底需要安装 `pico2wave`、`espeak-ng` 或 `espeak`（按此顺序尝试）。发音 API 的每 IP 限流记录保存在可写的 `.data/tts-request-monitor.sqlite` 中。

## 博客投稿与审核

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

## HTML 安全策略

文章可以使用段落、表格、折叠内容、图片和文本格式等普通 HTML。投稿预览和公开文章使用同一套白名单渲染流程。

以下内容会被移除：

- `script`、`iframe`、`frame`、`object`、`embed`、`applet`
- `form`、`input`、`button`、`select`、`textarea`
- `style`、`link`、`meta`、`base`
- `onclick`、`onerror` 等事件属性
- `javascript:` 等危险 URL 协议

清洗发生在 KaTeX 和代码高亮之前，用户内容无法利用它们生成的内部标记绕过白名单。

## LLM 设置云备份

LLM Provider、模型和 API Key 默认只保存在当前浏览器。登录已验证账号后，设置页也提供手动上传和下载功能，但**不推荐使用**：任何包含 API Key 的云端数据都存在风险，没有系统能够完全保证安全。

上传前，浏览器使用用户单独输入的备份密码，通过 PBKDF2-SHA-256 派生密钥并以 AES-256-GCM 加密。服务器只保存密文、salt 和 IV，不接收或保存备份密码。下载后也只在浏览器中解密。备份密码无法找回，遗失后云端备份无法恢复；下载操作会替换当前浏览器中的 LLM 设置。

## 常用命令

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

## 项目结构

```text
main/
├── content/                  # About 内容和旧文章导入源
├── database/                 # PostgreSQL schema 与初始化脚本
├── deploy/                   # systemd 和 Nginx 示例
├── docs/                     # 架构、博客与 API 文档
├── public/            # 公共字体、图标、头像和背景
├── scripts/                  # 导入、数据构建、提醒和部署任务
└── src/
    ├── app/                  # 与公开 URL 一一对应的页面和 API
    ├── components/           # 页面组件
    ├── config/               # 博客与工具配置
    ├── hooks/                # 页面 hooks
    ├── lib/                  # 认证、数据库、邮件、i18n 与客户端 API
    ├── styles/               # 功能样式
    └── theme/                # 全局主题
```

详细设计见 [`docs/blog/architecture.md`](docs/blog/architecture.md)，接口说明见 [`docs/tool/auth-api.md`](docs/tool/auth-api.md) 和 [`docs/tool/client-api.md`](docs/tool/client-api.md)。

## 部署

```bash
bun run build
bun run start -- -p 3000
```

应用本身不终止 TLS，生产环境建议使用反向代理。Nginx 示例位于 [`deploy/nginx.conf.example`](deploy/nginx.conf.example)，systemd 单元位于 `deploy/`。

GitHub Actions 会构建应用，并把一个发布包（受版本控制的源码加构建产物）上传到服务器，由 [`deploy/install-release.sh`](deploy/install-release.sh) 安装依赖、应用数据库 schema、依次运行 `scripts/deploy/` 任务、安装服务单元、切换到新版本（保留 `.data/` 和上一个版本）并健康检查。服务器全程不访问 GitHub：依赖来自 `bun.lock` 里固定的 npm 镜像，Bun 从镜像下载（CN 使用 npmmirror 和 gh.koi.ci GitHub 代理），并用固定的 SHA-256 校验。部署默认关闭；设置仓库变量 `DEPLOY_ENABLED=true` 后，在 Actions 里手动运行 **Deploy** 工作流并选择目标：`global` 把 `main` 部署到 jadren.me（环境 `production-global`），`cn` 把 `main-cn` 部署到 jadren.cn（环境 `production-cn`）。每个环境各自保存完整的一套 secrets（应用配置和 `SSH_*`），不再使用仓库级 secrets。日常开发在 `dev` 分支进行；`main-cn` 在 `main` 之上带有 CN 专属补丁（域名、备案号、移除的服务）。部署任务必须可重复执行，最终数据库状态应始终保留在 `database/schema.sql`。

## 许可证

项目采用 [MIT License](LICENSE)。第三方数据和资源的许可证见 [`THIRD_PARTY_LICENSES`](THIRD_PARTY_LICENSES)。
