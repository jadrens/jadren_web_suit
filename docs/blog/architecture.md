# Architecture

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Next.js 16 (App Router) |
| UI Library | React 19 |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 + MUI v9 (Emotion) |
| Runtime | Bun |
| Markdown | react-markdown + remark-gfm + remark-math |
| Code Highlight | Shiki + rehype-highlight |
| Math | KaTeX (rehype-katex) |
| Animation | Framer Motion, Matter.js |
| Database | PostgreSQL (server-only view counters and tool data) |
| Search | Pre-built JSON index via gray-matter |

## Directory Structure

```
.
├── content/                     # User-editable content
│   ├── about/                   # About page markdown (en.md / zh.md)
│   └── posts/                   # Blog articles
│       ├── en/                  # English articles (*.md)
│       └── zh/                  # Chinese articles (*.md)
│
├── data/                        # Runtime generated data
│   ├── views.db                 # Legacy view-counter backup/import source
│   └── search-index/            # Pre-built search indices
│       ├── index-en.json
│       └── index-zh.json
│
├── docs/                        # Documentation
│   ├── architecture.md
│   ├── getting-start-zh_CN.md
│   └── pics/                    # Screenshots used in docs
│
├── public/
│   └── avatar.png               # Homepage avatar
│
├── src/
│   ├── app/                     # Next.js App Router pages
│   │   ├── layout.tsx           # Root layout (fonts, theme, i18n, MUI registry)
│   │   ├── page.tsx             # Homepage (avatar + StylizedName + confetti)
│   │   ├── globals.css          # Tailwind + MUI theme overrides
│   │   ├── robots.ts            # robots.txt generation
│   │   ├── sitemap.ts           # sitemap.xml generation
│   │   ├── error.tsx            # Error boundary page
│   │   ├── not-found.tsx        # 404 page
│   │   ├── icon.png             # Favicon
│   │   ├── about/
│   │   │   ├── page.tsx         # About page (SSR, reads content/about/*.md)
│   │   │   └── AboutClient.tsx  # About page client component
│   │   ├── blog/
│   │   │   ├── actions.ts       # Server actions (getPosts, getPostView, incrementView)
│   │   │   ├── BlogContent.tsx  # Blog listing page (search/filter/sort)
│   │   │   └── [locale]/
│   │   │       ├── page.tsx     # Blog list page
│   │   │       └── [slug]/
│   │   │           ├── page.tsx # Blog post page (SSR)
│   │   │           └── PostClient.tsx  # Post client component (TOC, sidebar, nav)
│   │   └── api/
│   │       └── search/
│   │           └── route.ts     # Search API endpoint
│   │
│   ├── components/
│   │   ├── content/             # Markdown rendering
│   │   │   ├── MarkdownContent.tsx  # react-markdown renderer with custom headings
│   │   │   └── CodeBlock.tsx        # Code block with copy button & syntax highlight
│   │   ├── home/                # Homepage components
│   │   │   ├── StylizedName.tsx     # Animated name display
│   │   │   └── ConfettiBackground.tsx  # Matter.js confetti canvas
│   │   ├── layout/              # Layout components
│   │   │   ├── Navbar.tsx           # Top nav (search, i18n switcher, theme toggle)
│   │   │   ├── Footer.tsx           # Page footer (copyright, contact icons)
│   │   │   ├── BouncingAvatar.tsx   # Avatar with bounce animation
│   │   │   ├── LoadingBar.tsx       # Top page loading bar (NProgress-style)
│   │   │   ├── SearchDrawer.tsx     # Mobile search drawer
│   │   │   ├── Utils.tsx            # Utility components
│   │   │   └── ThemeRegistry/
│   │   │       ├── ThemeRegistry.tsx    # MUI ThemeProvider + Emotion cache
│   │   │       └── ThemeProvider.tsx    # Dark/light theme state
│   │   ├── navigation/          # Navigation controls
│   │   │   ├── LocaleSwitcher.tsx    # zh/en language toggle button
│   │   │   └── ThemeToggle.tsx       # Dark/light mode toggle button
│   │   ├── sidebar/             # Sidebar components
│   │   │   └── PostsSidebar.tsx     # Posts list sidebar on blog page
│   │   ├── toc/                 # Table of contents
│   │   │   ├── TableOfContents.tsx       # Desktop TOC sidebar
│   │   │   ├── TableOfContentsDrawer.tsx # Mobile TOC drawer
│   │   │   └── FloatingTOCButton.tsx     # Floating TOC open button (mobile)
│   │   └── reading/             # Reading progress
│   │       ├── ReadingProgressContext.tsx  # Context for scroll + heading tracking
│   │       ├── ReadingProgressBar.tsx      # Top progress bar
│   │       └── BackToTopButton.tsx         # Floating back-to-top button
│   │
│   ├── hooks/                   # Custom React hooks
│   │   ├── useBrowserConfig.ts  # Browser config detection
│   │   ├── useHeadingObserver.ts # Intersection observer for headings
│   │   └── useScrollProgress.ts # Scroll position tracker (0–100%)
│   │
│   ├── lib/                     # Core library modules
│   │   ├── posts.ts             # Post reader (reads content/posts/ + search index)
│   │   ├── search-index.ts      # Search index builder (gray-matter → JSON index)
│   │   ├── db.ts                # PostgreSQL view counter
│   │   └── i18n/
│   │       ├── index.tsx        # I18nProvider + useI18n hook (React context)
│   │       ├── en.ts            # English translations
│   │       └── zh.ts            # Chinese translations
│   │
│   ├── var/                     # Site configuration
│   │   ├── config.ts            # SITE_CONFIG (baseUrl, siteName, ...)
│   │   ├── contact.ts           # CONTACT_CONFIG (social links)
│   │   └── toc.ts               # TOC layout constants
│   │
│   └── style/
│       └── misans.css           # MiSans font face definitions
│
├── next.config.ts               # Next.js config
├── tailwind.config.ts           # Tailwind configuration
├── tsconfig.json                # TypeScript config
├── package.json                 # Dependencies & scripts
├── LICENSE                      # MIT License
└── README.md                    # English readme
```

## Routing Overview

| Route | File | Description |
|-------|------|-------------|
| `/` | `src/app/page.tsx` | Homepage with avatar and animated name |
| `/about` | `src/app/about/page.tsx` | About page, reads `content/about/*.md` |
| `/blog/en` | `src/app/blog/[locale]/page.tsx` | English blog listing |
| `/blog/zh` | `src/app/blog/[locale]/page.tsx` | Chinese blog listing |
| `/blog/en/<slug>` | `src/app/blog/[locale]/[slug]/page.tsx` | Single blog post |
| `/api/search` | `src/app/api/search/route.ts` | Search API (GET) |

All blog pages use `dynamic = "force-dynamic"` (SSR only, no static generation).

## Data Flow

### Content Pipeline

```
content/posts/{locale}/*.md        # Raw markdown with YAML frontmatter
        │
        ▼
src/lib/search-index.ts            # gray-matter parses frontmatter
        │                           # Builds PostMeta[], generates JSON index
        ▼
data/search-index/index-{locale}.json   # Cached search index
        │
        ▼
src/lib/posts.ts                   # Reads index + markdown files
        │                           # Returns Post[] with content
        ▼
src/app/blog/                      # Renders pages with MarkdownContent
```

### Search Index Strategy

- **Build-on-read**: The index is regenerated lazily when `getSearchIndex()` is called and file changes are detected (mtime + slug set comparison)
- **Auto-fill**: Missing `date` or `description` fields in frontmatter are auto-populated and written back to the `.md` file on first access
- **No build step needed**: Content changes are picked up on next request without restarting

### View Counter

```
src/lib/db.ts (PostgreSQL)
        │
        ▼
src/app/blog/actions.ts            # Server actions (getPostViews, incrementPostViews)
        │                           # "use server" — runs on server
        ▼
src/app/blog/[locale]/[slug]/PostClient.tsx  # Client component calls incrementView
```

- Database: PostgreSQL table `blog_post_view(slug, view_count, created_at, updated_at)`
- Atomic `INSERT ... ON CONFLICT` increments avoid lost counts under concurrent visits
- `bun run blog-views:migrate` imports legacy `data/views.db` counts idempotently

### i18n

```
src/lib/i18n/
├── en.ts                     # English translation keys
├── zh.ts                     # Chinese translation keys
└── index.tsx                 # I18nProvider context
        │
        ├── Detects browser language (navigator.language)
        ├── Falls back to localStorage → browser detection → "en"
        └── All UI strings via useI18n() hook → t.nav.home, t.blog.views, etc.
```

## Component Architecture

### Layout Hierarchy

```
<html>
  <ThemeRegistry>           ← MUI ThemeProvider + Emotion cache (avoids flicker)
    <I18nProvider>          ← Locale state + localStorage persistence
      <LoadingBar />        ← Top progress bar (NProgress-style)
      {children}            ← Page content
    </I18nProvider>
  </ThemeRegistry>
</html>
```

### Blog Post Page Structure

```
Navbar
  ├─ Logo/Avatar (link to /)
  ├─ Nav items (Home, Posts, About)
  ├─ LocaleSwitcher (zh ↔ en)
  ├─ ThemeToggle (dark ↔ light)
  └─ Search box (⌘K, with Portal dropdown)
PostClient
  ├─ ReadingProgressBar        ← Tracks scroll 0–100%
  ├─ PostsSidebar (drawer)     ← All posts list
  ├─ TableOfContents (desktop) ← Heading tree
  ├─ MarkdownContent           ← react-markdown rendered content
  │    ├─ HeadingWithAnchor    ← Clickable headings with hash links
  │    └─ CodeBlock            ← Syntax highlighted code + copy button
  ├─ FloatingTOCButton (mobile)← Opens TOC drawer
  ├─ BackToTopButton           ← Scroll-to-top button
  └─ Adjacent post navigation  ← Prev / Next post links
Footer
```
