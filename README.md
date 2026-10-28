# QR TO LINK — Monorepo Architecture

Professional, production-ready single monorepo containing the **Responsive Website**, **React Native / Expo Mobile Application**, **Admin Dashboard**, **Clean-Architecture Shared Backend API**, **Database**, and **Shared Packages**.

---

## 📁 Monorepo Structure

```text
qr-to-link-monorepo/
│
├── apps/
│   ├── web/                  # Production Responsive Website (SEO, OpenGraph, Schema.org)
│   ├── mobile/               # React Native + Expo Mobile Application (iOS & Android)
│   └── admin/                # Admin Dashboard (Protected, non-indexed telemetry console)
│
├── packages/
│   ├── ui/                   # Shared UI design tokens & components
│   ├── api/                  # Shared API Client SDK
│   ├── seo/                  # SEO metadata, OpenGraph, sitemap & schema.org generators
│   ├── types/                # Shared TypeScript type definitions
│   ├── utils/                # Shared helper functions
│   ├── validation/           # Shared Zod / validation schemas
│   └── config/               # Shared app configuration
│
├── backend/                  # Shared Express / Node REST API backend (Clean Architecture)
│   ├── src/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── services/
│   │   └── repositories/
│   └── package.json
│
├── database/                 # Database migrations, PostgreSQL schemas & seeds
│   ├── schema.sql
│   └── seed/
│
├── .github/
│   └── workflows/            # GitHub Actions CI/CD Pipeline
│
├── pnpm-workspace.yaml       # PNPM Workspace Configuration
├── turbo.json                # Turborepo Pipeline
├── package.json              # Root package configuration
├── tsconfig.json             # Root TypeScript config
├── .env.example              # Environment variables template
└── README.md                 # Complete documentation
```

---

## 🚀 Key Monorepo Features

1. **Single Monorepo Repository**: Website, Mobile App, Admin Dashboard, and Backend in one single repository managed by **PNPM Workspaces** and **Turborepo**.
2. **Shared Packages**: Zero business logic duplication across Web, Mobile, and Admin (`@qr-to-link/api`, `@qr-to-link/seo`, `@qr-to-link/types`, `@qr-to-link/utils`, `@qr-to-link/validation`, `@qr-to-link/ui`, `@qr-to-link/config`).
3. **Complete SEO System**:
   - Meta tags, Dynamic Page Titles, Canonical URLs
   - OpenGraph Tags (`og:title`, `og:description`, `og:image`, `og:type`)
   - Twitter / X Cards (`summary_large_image`)
   - Schema.org JSON-LD Structured Data (`WebSite`, `SoftwareApplication`, `FAQPage`)
   - `/sitemap.xml` & `/robots.txt` automatically generated
   - Google Search Console inspection metadata hook
4. **Clean Architecture Backend**:
   - Clean separation into `Routes -> Controllers -> Services -> Repositories -> Database`
   - Dynamic shortcode redirect engine (`/sc/:shortCode`) with PIN security & expiration validation
   - Image upload object storage and Gemini 3.8 AI QR optical diffusion API
5. **Mobile Application**:
   - Built with **React Native + Expo + TypeScript** (`apps/mobile`)
   - Point camera scanner, dynamic fleet dashboard, and vector generation

---

## 🛠️ Getting Started & Installation

### Prerequisites
- Node.js >= 18.0.0
- pnpm >= 9.0.0

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/your-org/qr-to-link.git
cd qr-to-link

# 2. Copy environment file
cp .env.example .env

# 3. Install all monorepo dependencies
pnpm install
```

---

## 💻 Development Commands

You can run commands for the entire monorepo or target individual workspace apps:

```bash
# Start all apps & backend concurrently
pnpm dev

# Start specific applications
pnpm dev:web       # Start Website on http://localhost:3000
pnpm dev:mobile    # Start Expo Mobile App
pnpm dev:backend   # Start Backend API on http://localhost:3000/api
pnpm dev:admin     # Start Admin Console on http://localhost:3001

# Monorepo maintenance & build
pnpm build        # Build all apps & packages using Turborepo
pnpm typecheck    # Typecheck all TypeScript workspaces
pnpm lint         # Lint all codebases
```

---

## 🔍 SEO Configuration

The website includes built-in SEO tools located in `packages/seo`:

- **Dynamic Page Metadata**: Created via `createPageMetadata({ title, description })`
- **Schema.org Generators**: Structured data via `generateWebsiteSchema()`, `generateSoftwareAppSchema()`, `generateFAQSchema()`
- **Sitemap Generator**: Automated `sitemap.xml` output
- **Robots Generator**: Dynamic `robots.txt` configuration forbidding `/admin` indexing while allowing search bots to index public generator pages.

---

## 🔒 Security & Best Practices

- Environment variables secured via `.env` and `.env.example`
- Admin pages marked with `<meta name="robots" content="noindex, nofollow" />`
- Express backend hardened with CORS headers, PIN vault hashing, and clean error sanitization

---

## 🌐 Deployment Configuration

- **Web & Admin**: Static SPA build outputs in `apps/web/dist` and `apps/admin/dist` ready for Vercel, Netlify, or Cloudflare Pages.
- **Backend API**: Node container ready for AWS ECS, Render, or Docker deployment.
- **Mobile**: Built via Expo Application Services (EAS) for iOS App Store and Google Play.
