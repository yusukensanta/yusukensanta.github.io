# Portfolio Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `yusukensanta.github.io` — an Astro 5 static site that aggregates documentation (overview, installation, contributing, changelog) from opted-in GitHub repos and auto-injects a badge back into each repo's README.

**Architecture:** Repos opt in via `.github/portfolio.yml`. A GitHub Actions workflow (nightly + on push) calls the GitHub API, extracts markdown sections from each opted-in repo, writes per-project JSON into `src/content/projects/`, rebuilds the Astro site, deploys to GitHub Pages, and patches each source repo's README.md via API with a badge linking to the docs page. Generated content files are never committed; they are produced at CI build time.

**Tech Stack:** Astro 5, TypeScript, pnpm, Vitest, @octokit/rest, js-yaml, marked, GitHub Actions

---

## File Map

| File | Role |
|------|------|
| `package.json` | Dependencies + `dev`, `dev:mock`, `build`, `test`, `sync` scripts |
| `astro.config.mjs` | Astro SSG config, output: `static` |
| `tsconfig.json` | TypeScript config |
| `vitest.config.mjs` | Vitest config pointing at `scripts/__tests__/` |
| `.gitignore` | Ignores `src/content/projects/*.json` (generated), `dist/`, `.astro/` |
| `src/content/config.ts` | Zod schema + `Project` type for content collection |
| `src/content/projects/` | **Generated at CI time** — one `.json` per opted-in repo |
| `src/content/projects.sample/` | Two sample `.json` files for local dev |
| `src/styles/global.css` | CSS custom properties, reset, base typography |
| `src/layouts/BaseLayout.astro` | HTML shell: `<head>`, global CSS, `<slot />` |
| `src/components/ProjectCard.astro` | Card for the index grid |
| `src/components/TabNav.astro` | Tab nav + inline `<script>` for switching |
| `src/pages/index.astro` | Landing: hero + responsive project grid |
| `src/pages/projects/[slug].astro` | Per-project doc page with tab sections |
| `scripts/markdown-utils.mjs` | Pure functions: extract sections from markdown text |
| `scripts/badge-utils.mjs` | Pure functions: detect / format / inject portfolio badge |
| `scripts/sync-projects.mjs` | Orchestrator: GitHub API → write JSON → inject badges |
| `scripts/__tests__/markdown-utils.test.mjs` | Unit tests for markdown parsing |
| `scripts/__tests__/badge-utils.test.mjs` | Unit tests for badge injection |
| `.github/workflows/sync-and-deploy.yml` | Nightly + push triggered sync → build → deploy |
| `.github/portfolio.yml.template` | Template users copy to their repos to opt in |

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `astro.config.mjs`
- Create: `tsconfig.json`
- Create: `vitest.config.mjs`
- Create: `.gitignore`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "yusukensanta-github-io",
  "type": "module",
  "scripts": {
    "dev": "astro dev",
    "dev:mock": "cp -r src/content/projects.sample/. src/content/projects/ && astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "check": "astro check",
    "test": "vitest run",
    "test:watch": "vitest",
    "sync": "node scripts/sync-projects.mjs"
  },
  "dependencies": {
    "astro": "^5.7.0",
    "marked": "^15.0.0"
  },
  "devDependencies": {
    "@astrojs/check": "^0.9.4",
    "@octokit/rest": "^21.1.1",
    "js-yaml": "^4.1.0",
    "typescript": "^5.8.3",
    "vitest": "^3.2.0"
  }
}
```

- [ ] **Step 2: Create `astro.config.mjs`**

```js
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://yusukensanta.github.io',
  output: 'static',
});
```

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

- [ ] **Step 4: Create `vitest.config.mjs`**

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['scripts/__tests__/**/*.test.mjs'],
  },
});
```

- [ ] **Step 5: Create `.gitignore`**

```
# Build output
dist/
.astro/

# Generated content (produced by sync script at CI time)
src/content/projects/*.json

# Node
node_modules/
.pnpm-store/

# Environment
.env
.env.local
```

- [ ] **Step 6: Install dependencies**

```bash
pnpm install
```

Expected: `node_modules/` created, `pnpm-lock.yaml` generated.

- [ ] **Step 7: Commit**

```bash
git add package.json astro.config.mjs tsconfig.json vitest.config.mjs .gitignore pnpm-lock.yaml
git commit -m "chore: initialize Astro project with pnpm"
```

---

## Task 2: Content Schema and Sample Data

**Files:**
- Create: `src/content/config.ts`
- Create: `src/content/projects.sample/demo-cli.json`
- Create: `src/content/projects.sample/web-toolkit.json`
- Create: `src/content/projects/` (empty dir placeholder)

- [ ] **Step 1: Create `src/content/config.ts`**

```typescript
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const projectSchema = z.object({
  title: z.string(),
  slug: z.string(),
  description: z.string(),
  repo: z.string(),
  stars: z.number().default(0),
  forks: z.number().default(0),
  homepage: z.string().nullable().optional(),
  tech_stack: z.array(z.string()).default([]),
  last_updated: z.string(),
  sections: z.object({
    readme: z.string().default(''),
    installation: z.string().default(''),
    contributing: z.string().default(''),
    changelog: z.string().default(''),
  }),
});

export type Project = z.infer<typeof projectSchema>;

const projects = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/projects' }),
  schema: projectSchema,
});

export const collections = { projects };
```

- [ ] **Step 2: Create `src/content/projects.sample/demo-cli.json`**

```json
{
  "title": "demo-cli",
  "slug": "demo-cli",
  "description": "A sample CLI tool for demonstration purposes.",
  "repo": "yusukensanta/demo-cli",
  "stars": 12,
  "forks": 2,
  "homepage": null,
  "tech_stack": ["Go", "Cobra"],
  "last_updated": "2026-04-10T08:00:00Z",
  "sections": {
    "readme": "# demo-cli\n\nA fast CLI tool built with Go and Cobra.\n\n![Build](https://img.shields.io/badge/build-passing-green)\n",
    "installation": "## Installation\n\n```bash\ngo install github.com/yusukensanta/demo-cli@latest\n```\n\nOr download a binary from the [releases page](https://github.com/yusukensanta/demo-cli/releases).\n",
    "contributing": "## Contributing\n\n1. Fork the repo\n2. Create a feature branch: `git checkout -b feat/my-feature`\n3. Commit your changes\n4. Open a pull request\n\nPlease run `go test ./...` before opening a PR.\n",
    "changelog": "## v0.2.0 — 2026-04-10\n\n- Add `--verbose` flag\n- Fix output encoding on Windows\n\n## v0.1.0 — 2026-03-01\n\n- Initial release\n"
  }
}
```

- [ ] **Step 3: Create `src/content/projects.sample/web-toolkit.json`**

```json
{
  "title": "web-toolkit",
  "slug": "web-toolkit",
  "description": "Utility functions for web projects: URL parsing, cookie helpers, fetch wrappers.",
  "repo": "yusukensanta/web-toolkit",
  "stars": 34,
  "forks": 5,
  "homepage": "https://yusukensanta.github.io/projects/web-toolkit/",
  "tech_stack": ["TypeScript", "Node.js"],
  "last_updated": "2026-05-01T12:00:00Z",
  "sections": {
    "readme": "# web-toolkit\n\nA collection of utility functions for web development.\n\n[![npm](https://img.shields.io/npm/v/web-toolkit)](https://www.npmjs.com/package/web-toolkit)\n",
    "installation": "## Installation\n\n```bash\npnpm add web-toolkit\n```\n\n```typescript\nimport { parseUrl, getCookie } from 'web-toolkit';\n```\n",
    "contributing": "## Contributing\n\nWe welcome contributions!\n\n- Run `pnpm test` to verify all tests pass\n- Follow conventional commits for commit messages\n- Open an issue before working on large changes\n",
    "changelog": "## v1.1.0 — 2026-05-01\n\n- Add `fetchWithRetry` utility\n- Improve TypeScript typings\n\n## v1.0.0 — 2026-02-15\n\n- Stable release\n"
  }
}
```

- [ ] **Step 4: Create `src/content/projects/.gitkeep`**

```bash
mkdir -p src/content/projects && touch src/content/projects/.gitkeep
```

- [ ] **Step 5: Commit**

```bash
git add src/content/config.ts src/content/projects.sample/ src/content/projects/.gitkeep
git commit -m "feat: add content schema and sample project data"
```

---

## Task 3: Global Styles and Base Layout

**Files:**
- Create: `src/styles/global.css`
- Create: `src/layouts/BaseLayout.astro`

- [ ] **Step 1: Create `src/styles/global.css`**

```css
:root {
  --color-bg: #ffffff;
  --color-surface: #f5f5f5;
  --color-border: #e0e0e0;
  --color-text: #1a1a1a;
  --color-text-muted: #6b6b6b;
  --color-primary: #2563eb;
  --color-primary-hover: #1d4ed8;
  --color-badge-bg: #eff6ff;
  --color-badge-text: #1d4ed8;
  --font-sans: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-mono: 'Fira Code', 'Cascadia Code', Consolas, monospace;
  --radius: 8px;
  --max-width: 1100px;
}

@media (prefers-color-scheme: dark) {
  :root {
    --color-bg: #0f0f0f;
    --color-surface: #1a1a1a;
    --color-border: #2e2e2e;
    --color-text: #e8e8e8;
    --color-text-muted: #9a9a9a;
    --color-primary: #60a5fa;
    --color-primary-hover: #93c5fd;
    --color-badge-bg: #1e3a5f;
    --color-badge-text: #93c5fd;
  }
}

*, *::before, *::after { box-sizing: border-box; }

body {
  margin: 0;
  font-family: var(--font-sans);
  background: var(--color-bg);
  color: var(--color-text);
  line-height: 1.6;
  font-size: 16px;
}

a {
  color: var(--color-primary);
  text-decoration: none;
}
a:hover { text-decoration: underline; }

code, pre {
  font-family: var(--font-mono);
  font-size: 0.9em;
}

pre {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  padding: 1rem;
  overflow-x: auto;
}

code:not(pre code) {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  padding: 0.1em 0.4em;
}

h1, h2, h3, h4 { line-height: 1.3; }

.container {
  max-width: var(--max-width);
  margin: 0 auto;
  padding: 0 1.5rem;
}
```

- [ ] **Step 2: Create `src/layouts/BaseLayout.astro`**

```astro
---
interface Props {
  title: string;
  description?: string;
}
const { title, description = 'Open source projects by yusukensanta' } = Astro.props;
const siteUrl = 'https://yusukensanta.github.io';
---

<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content={description} />
    <meta property="og:title" content={title} />
    <meta property="og:description" content={description} />
    <meta property="og:url" content={siteUrl} />
    <title>{title}</title>
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
  </head>
  <body>
    <nav class="site-nav">
      <div class="container nav-inner">
        <a class="nav-brand" href="/">yusukensanta</a>
        <a href="https://github.com/yusukensanta" target="_blank" rel="noopener">GitHub</a>
      </div>
    </nav>

    <main class="container">
      <slot />
    </main>

    <footer class="site-footer">
      <div class="container">
        <p>Built with <a href="https://astro.build">Astro</a> · Auto-synced from GitHub</p>
      </div>
    </footer>
  </body>
</html>

<style is:global>
  @import '../styles/global.css';

  .site-nav {
    border-bottom: 1px solid var(--color-border);
    padding: 0.75rem 0;
    position: sticky;
    top: 0;
    background: var(--color-bg);
    z-index: 10;
  }
  .nav-inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .nav-brand {
    font-weight: 700;
    font-size: 1.1rem;
    color: var(--color-text);
  }
  main { padding: 2rem 1.5rem; }
  .site-footer {
    border-top: 1px solid var(--color-border);
    padding: 1.5rem 0;
    margin-top: 4rem;
    color: var(--color-text-muted);
    font-size: 0.875rem;
    text-align: center;
  }
</style>
```

- [ ] **Step 3: Create `public/favicon.svg`**

```bash
mkdir -p public
cat > public/favicon.svg << 'EOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="6" fill="#2563eb"/>
  <text x="16" y="23" font-size="18" text-anchor="middle" fill="white" font-family="monospace">Y</text>
</svg>
EOF
```

- [ ] **Step 4: Verify dev server starts with mock data**

```bash
pnpm dev:mock
```

Expected: server starts at `http://localhost:4321` with no errors.

- [ ] **Step 5: Commit**

```bash
git add src/styles/ src/layouts/ public/
git commit -m "feat: add global CSS, base layout, and favicon"
```

---

## Task 4: ProjectCard Component

**Files:**
- Create: `src/components/ProjectCard.astro`

- [ ] **Step 1: Create `src/components/ProjectCard.astro`**

```astro
---
import type { Project } from '../content/config';

interface Props {
  project: Project;
}
const { project } = Astro.props;

const repoUrl = `https://github.com/${project.repo}`;
const docsUrl = `/projects/${project.slug}/`;
const updatedDate = new Date(project.last_updated).toLocaleDateString('en-US', {
  year: 'numeric',
  month: 'short',
});
---

<article class="project-card">
  <div class="card-header">
    <a class="card-title" href={docsUrl}>{project.title}</a>
    <span class="stars" title="GitHub stars">★ {project.stars}</span>
  </div>

  <p class="card-description">{project.description}</p>

  {project.tech_stack.length > 0 && (
    <ul class="tech-list" aria-label="Tech stack">
      {project.tech_stack.map(t => <li class="tech-badge">{t}</li>)}
    </ul>
  )}

  <div class="card-footer">
    <span class="updated">Updated {updatedDate}</span>
    <div class="card-links">
      <a href={docsUrl}>Docs</a>
      <a href={repoUrl} target="_blank" rel="noopener">GitHub</a>
      {project.homepage && <a href={project.homepage} target="_blank" rel="noopener">Demo</a>}
    </div>
  </div>
</article>

<style>
  .project-card {
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    padding: 1.25rem;
    background: var(--color-surface);
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    transition: border-color 0.15s;
  }
  .project-card:hover { border-color: var(--color-primary); }

  .card-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.5rem;
  }
  .card-title {
    font-weight: 700;
    font-size: 1.1rem;
    color: var(--color-text);
  }
  .card-title:hover { color: var(--color-primary); text-decoration: none; }

  .stars {
    font-size: 0.85rem;
    color: var(--color-text-muted);
    white-space: nowrap;
  }

  .card-description {
    margin: 0;
    color: var(--color-text-muted);
    font-size: 0.9rem;
    flex: 1;
  }

  .tech-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
  }
  .tech-badge {
    background: var(--color-badge-bg);
    color: var(--color-badge-text);
    border-radius: 4px;
    padding: 0.15em 0.5em;
    font-size: 0.8rem;
    font-weight: 500;
  }

  .card-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.825rem;
    color: var(--color-text-muted);
  }
  .card-links { display: flex; gap: 0.75rem; }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ProjectCard.astro
git commit -m "feat: add ProjectCard component"
```

---

## Task 5: Index Page

**Files:**
- Create: `src/pages/index.astro`

- [ ] **Step 1: Create `src/pages/index.astro`**

```astro
---
import { getCollection } from 'astro:content';
import BaseLayout from '../layouts/BaseLayout.astro';
import ProjectCard from '../components/ProjectCard.astro';
import type { Project } from '../content/config';

const entries = await getCollection('projects');
const projects = entries
  .map(e => e.data as Project)
  .sort((a, b) => b.stars - a.stars);
---

<BaseLayout title="yusukensanta — Open Source Projects">
  <section class="hero">
    <h1>Open Source Projects</h1>
    <p class="hero-sub">Documentation auto-synced from GitHub</p>
  </section>

  {projects.length === 0 ? (
    <p class="empty-state">No projects synced yet. Run <code>pnpm sync</code> or <code>pnpm dev:mock</code> locally.</p>
  ) : (
    <section class="project-grid" aria-label="Projects">
      {projects.map(project => <ProjectCard project={project} />)}
    </section>
  )}
</BaseLayout>

<style>
  .hero {
    padding: 3rem 0 2rem;
    border-bottom: 1px solid var(--color-border);
    margin-bottom: 2rem;
  }
  .hero h1 { margin: 0 0 0.5rem; font-size: 2rem; }
  .hero-sub { margin: 0; color: var(--color-text-muted); }

  .project-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1.25rem;
  }

  .empty-state {
    color: var(--color-text-muted);
    padding: 2rem 0;
  }
</style>
```

- [ ] **Step 2: Verify index renders with mock data**

```bash
pnpm dev:mock
```

Open `http://localhost:4321` — expect two project cards (demo-cli, web-toolkit) in a grid.

- [ ] **Step 3: Commit**

```bash
git add src/pages/index.astro
git commit -m "feat: add index page with project grid"
```

---

## Task 6: TabNav Component

**Files:**
- Create: `src/components/TabNav.astro`

- [ ] **Step 1: Create `src/components/TabNav.astro`**

```astro
---
interface Tab {
  id: string;
  label: string;
}
interface Props {
  tabs: Tab[];
}
const { tabs } = Astro.props;
---

<nav class="tab-nav" role="tablist">
  {tabs.map((tab, i) => (
    <button
      class={`tab-btn${i === 0 ? ' active' : ''}`}
      role="tab"
      aria-selected={i === 0 ? 'true' : 'false'}
      aria-controls={tab.id}
      data-tab={tab.id}
    >
      {tab.label}
    </button>
  ))}
</nav>

<script>
  function initTabs() {
    const navs = document.querySelectorAll<HTMLElement>('.tab-nav');
    navs.forEach(nav => {
      const buttons = nav.querySelectorAll<HTMLButtonElement>('.tab-btn');

      function showTab(tabId: string) {
        buttons.forEach(btn => {
          const active = btn.dataset.tab === tabId;
          btn.classList.toggle('active', active);
          btn.setAttribute('aria-selected', String(active));
        });
        document.querySelectorAll<HTMLElement>('.tab-panel').forEach(panel => {
          panel.hidden = panel.id !== tabId;
        });
      }

      if (buttons.length > 0) {
        showTab(buttons[0].dataset.tab ?? '');
      }

      buttons.forEach(btn => {
        btn.addEventListener('click', () => showTab(btn.dataset.tab ?? ''));
      });
    });
  }

  initTabs();
</script>

<style>
  .tab-nav {
    display: flex;
    gap: 0;
    border-bottom: 2px solid var(--color-border);
    margin-bottom: 1.5rem;
  }
  .tab-btn {
    background: none;
    border: none;
    padding: 0.6rem 1.25rem;
    font-size: 0.95rem;
    cursor: pointer;
    color: var(--color-text-muted);
    border-bottom: 2px solid transparent;
    margin-bottom: -2px;
    transition: color 0.15s, border-color 0.15s;
  }
  .tab-btn:hover { color: var(--color-text); }
  .tab-btn.active {
    color: var(--color-primary);
    border-bottom-color: var(--color-primary);
    font-weight: 600;
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/TabNav.astro
git commit -m "feat: add TabNav component with accessible tab switching"
```

---

## Task 7: Project Detail Page

**Files:**
- Create: `src/pages/projects/[slug].astro`

- [ ] **Step 1: Create `src/pages/projects/[slug].astro`**

```astro
---
import { getCollection } from 'astro:content';
import { marked } from 'marked';
import BaseLayout from '../../layouts/BaseLayout.astro';
import TabNav from '../../components/TabNav.astro';
import type { Project } from '../../content/config';

export async function getStaticPaths() {
  const entries = await getCollection('projects');
  return entries.map(entry => ({
    params: { slug: entry.id },
    props: { project: entry.data as Project },
  }));
}

const { project } = Astro.props;

const SECTION_CONFIG = [
  { id: 'readme', label: 'Overview' },
  { id: 'installation', label: 'Installation' },
  { id: 'contributing', label: 'Contributing' },
  { id: 'changelog', label: 'Changelog' },
] as const;

type SectionId = (typeof SECTION_CONFIG)[number]['id'];

const tabs = SECTION_CONFIG.filter(
  s => project.sections[s.id as SectionId]?.trim()
);

const rendered: Record<string, string> = {};
for (const s of SECTION_CONFIG) {
  const content = project.sections[s.id as SectionId] ?? '';
  rendered[s.id] = content ? (marked.parse(content) as string) : '';
}

const updatedDate = new Date(project.last_updated).toLocaleDateString('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});
---

<BaseLayout title={`${project.title} — yusukensanta`} description={project.description}>
  <header class="project-header">
    <div class="breadcrumb"><a href="/">← Projects</a></div>
    <h1>{project.title}</h1>
    <p class="project-description">{project.description}</p>

    <div class="project-meta">
      {project.stars > 0 && <span>★ {project.stars} stars</span>}
      {project.forks > 0 && <span>{project.forks} forks</span>}
      <span>Updated {updatedDate}</span>
    </div>

    {project.tech_stack.length > 0 && (
      <ul class="tech-list" aria-label="Tech stack">
        {project.tech_stack.map(t => <li class="tech-badge">{t}</li>)}
      </ul>
    )}

    <div class="project-links">
      <a href={`https://github.com/${project.repo}`} target="_blank" rel="noopener">View on GitHub</a>
      {project.homepage && (
        <a href={project.homepage} target="_blank" rel="noopener">Live Demo</a>
      )}
    </div>
  </header>

  {tabs.length > 1 && <TabNav tabs={tabs} />}

  {SECTION_CONFIG.map(s => rendered[s.id] && (
    <section
      id={s.id}
      class="tab-panel prose"
      role="tabpanel"
      aria-labelledby={s.id}
      hidden={tabs.length > 1 && s.id !== tabs[0].id}
      set:html={rendered[s.id]}
    />
  ))}
</BaseLayout>

<style>
  .project-header {
    padding: 2rem 0 1.5rem;
    border-bottom: 1px solid var(--color-border);
    margin-bottom: 2rem;
  }
  .breadcrumb {
    font-size: 0.875rem;
    margin-bottom: 1rem;
    color: var(--color-text-muted);
  }
  .project-header h1 { margin: 0 0 0.5rem; font-size: 2rem; }
  .project-description { margin: 0 0 1rem; color: var(--color-text-muted); }

  .project-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    font-size: 0.875rem;
    color: var(--color-text-muted);
    margin-bottom: 0.75rem;
  }

  .tech-list {
    list-style: none;
    padding: 0;
    margin: 0 0 1rem;
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
  }
  .tech-badge {
    background: var(--color-badge-bg);
    color: var(--color-badge-text);
    border-radius: 4px;
    padding: 0.15em 0.5em;
    font-size: 0.8rem;
    font-weight: 500;
  }

  .project-links { display: flex; gap: 1rem; font-size: 0.9rem; }

  /* Prose styles for rendered markdown */
  .prose :global(h1),
  .prose :global(h2),
  .prose :global(h3) {
    margin-top: 1.75rem;
    margin-bottom: 0.5rem;
  }
  .prose :global(p) { margin: 0 0 1rem; }
  .prose :global(ul), .prose :global(ol) { padding-left: 1.5rem; margin: 0 0 1rem; }
  .prose :global(img) { max-width: 100%; border-radius: var(--radius); }
  .prose :global(table) {
    width: 100%;
    border-collapse: collapse;
    margin: 0 0 1rem;
    font-size: 0.9rem;
  }
  .prose :global(th), .prose :global(td) {
    border: 1px solid var(--color-border);
    padding: 0.5rem 0.75rem;
    text-align: left;
  }
  .prose :global(th) { background: var(--color-surface); font-weight: 600; }
  .prose :global(blockquote) {
    border-left: 4px solid var(--color-primary);
    margin: 0 0 1rem;
    padding: 0.5rem 1rem;
    color: var(--color-text-muted);
  }
</style>
```

- [ ] **Step 2: Verify project page renders with mock data**

```bash
pnpm dev:mock
```

Open `http://localhost:4321/projects/demo-cli/` — expect page with header, tabs (Overview / Installation / Contributing / Changelog), and markdown-rendered content in each tab.

- [ ] **Step 3: Verify static build**

```bash
pnpm build
```

Expected: `dist/` created, no build errors.

- [ ] **Step 4: Commit**

```bash
git add src/pages/projects/
git commit -m "feat: add per-project doc page with tab sections"
```

---

## Task 8: Markdown Utilities + Tests

**Files:**
- Create: `scripts/markdown-utils.mjs`
- Create: `scripts/__tests__/markdown-utils.test.mjs`

- [ ] **Step 1: Write failing tests first**

Create `scripts/__tests__/markdown-utils.test.mjs`:

```js
import { describe, it, expect } from 'vitest';
import {
  extractSections,
  findSection,
  extractOverview,
  extractInstallation,
} from '../markdown-utils.mjs';

describe('extractSections', () => {
  it('captures preamble (content before first h2)', () => {
    const md = '# Title\n\nIntro text here\n\n## Installation\n\nnpm install\n';
    const sections = extractSections(md);
    expect(sections['__preamble__']).toBe('# Title\n\nIntro text here');
    expect(sections['installation']).toBe('npm install');
  });

  it('handles markdown with no h2 headings', () => {
    const md = '# Title\n\nAll content, no sections.';
    const sections = extractSections(md);
    expect(sections['__preamble__']).toBe('# Title\n\nAll content, no sections.');
    expect(Object.keys(sections)).toHaveLength(1);
  });

  it('handles empty string', () => {
    const sections = extractSections('');
    expect(sections['__preamble__']).toBe('');
  });

  it('normalizes heading text to lowercase and trims', () => {
    const md = '## Getting Started\n\ncontent here\n\n## Contributing  \n\nother content';
    const sections = extractSections(md);
    expect(sections['getting started']).toBe('content here');
    expect(sections['contributing']).toBe('other content');
  });

  it('captures multiple sections', () => {
    const md = '## A\n\nalpha\n\n## B\n\nbeta\n\n## C\n\ngamma';
    const sections = extractSections(md);
    expect(sections['a']).toBe('alpha');
    expect(sections['b']).toBe('beta');
    expect(sections['c']).toBe('gamma');
  });
});

describe('findSection', () => {
  it('returns content for exact alias match', () => {
    const sections = { '__preamble__': '', 'installation': 'npm install' };
    expect(findSection(sections, ['installation', 'setup'])).toBe('npm install');
  });

  it('tries subsequent aliases when first does not exist', () => {
    const sections = { '__preamble__': '', 'setup': 'setup steps' };
    expect(findSection(sections, ['installation', 'setup'])).toBe('setup steps');
  });

  it('does partial key matching', () => {
    const sections = { '__preamble__': '', 'getting started with the cli': 'install steps' };
    expect(findSection(sections, ['getting started'])).toBe('install steps');
  });

  it('returns empty string when no alias matches', () => {
    const sections = { '__preamble__': '', 'usage': 'some usage' };
    expect(findSection(sections, ['installation', 'setup'])).toBe('');
  });

  it('skips empty sections', () => {
    const sections = { 'installation': '', 'setup': 'setup content' };
    expect(findSection(sections, ['installation', 'setup'])).toBe('setup content');
  });
});

describe('extractOverview', () => {
  it('returns preamble text (content before first h2)', () => {
    const md = '# My Project\n\nCool description.\n\n## Installation\n\nnpm install';
    expect(extractOverview(md)).toBe('# My Project\n\nCool description.');
  });

  it('returns full content when no h2 exists', () => {
    const md = '# Title\n\nOnly content.';
    expect(extractOverview(md)).toBe('# Title\n\nOnly content.');
  });
});

describe('extractInstallation', () => {
  it('extracts ## Installation section from README', () => {
    const md = '# Title\n\n## Installation\n\nnpm install\n\n## Usage\n\nsome usage';
    expect(extractInstallation(md)).toBe('npm install');
  });

  it('falls back to "getting started" alias', () => {
    const md = '# Title\n\n## Getting Started\n\npip install pkg';
    expect(extractInstallation(md)).toBe('pip install pkg');
  });

  it('falls back to "setup" alias', () => {
    const md = '# Title\n\n## Setup\n\ngo install cmd';
    expect(extractInstallation(md)).toBe('go install cmd');
  });

  it('returns empty string when no installation section found', () => {
    const md = '# Title\n\n## Usage\n\nsome usage';
    expect(extractInstallation(md)).toBe('');
  });
});
```

- [ ] **Step 2: Run tests — verify they all fail**

```bash
pnpm test
```

Expected: `FAIL` for all tests (module not found).

- [ ] **Step 3: Implement `scripts/markdown-utils.mjs`**

```js
/**
 * Split markdown into sections by ## headings.
 * Returns a map of lowercased heading text → trimmed content.
 * Content before the first ## heading is stored under '__preamble__'.
 *
 * @param {string} markdown
 * @returns {Record<string, string>}
 */
export function extractSections(markdown) {
  const lines = markdown.split('\n');
  const sections = {};
  let currentKey = '__preamble__';
  let buffer = [];

  for (const line of lines) {
    const h2 = line.match(/^## (.+)/);
    if (h2) {
      sections[currentKey] = buffer.join('\n').trim();
      currentKey = h2[1].toLowerCase().trim();
      buffer = [];
    } else {
      buffer.push(line);
    }
  }
  sections[currentKey] = buffer.join('\n').trim();

  return sections;
}

/**
 * Find the first non-empty section matching any alias (exact then partial).
 *
 * @param {Record<string, string>} sections
 * @param {string[]} aliases
 * @returns {string}
 */
export function findSection(sections, aliases) {
  for (const alias of aliases) {
    const key = alias.toLowerCase();
    if (sections[key]?.trim()) return sections[key];
    const partialKey = Object.keys(sections).find(k => k.includes(key));
    if (partialKey && sections[partialKey]?.trim()) return sections[partialKey];
  }
  return '';
}

/**
 * Extract the overview: text before the first ## heading.
 *
 * @param {string} markdown
 * @returns {string}
 */
export function extractOverview(markdown) {
  return extractSections(markdown)['__preamble__'] ?? '';
}

/**
 * Extract the installation section from a README, trying common heading names.
 *
 * @param {string} readme
 * @returns {string}
 */
export function extractInstallation(readme) {
  return findSection(extractSections(readme), [
    'installation',
    'getting started',
    'quick start',
    'setup',
    'install',
  ]);
}
```

- [ ] **Step 4: Run tests — verify all pass**

```bash
pnpm test
```

Expected: all tests `PASS`, ≥ 90% coverage on `markdown-utils.mjs`.

- [ ] **Step 5: Commit**

```bash
git add scripts/markdown-utils.mjs scripts/__tests__/markdown-utils.test.mjs
git commit -m "feat: add markdown section extraction utilities with tests"
```

---

## Task 9: Badge Utilities + Tests

**Files:**
- Create: `scripts/badge-utils.mjs`
- Create: `scripts/__tests__/badge-utils.test.mjs`

- [ ] **Step 1: Write failing tests first**

Create `scripts/__tests__/badge-utils.test.mjs`:

```js
import { describe, it, expect } from 'vitest';
import { hasBadge, formatBadge, injectBadge } from '../badge-utils.mjs';

const MARKER = '<!-- portfolio-badge -->';

describe('hasBadge', () => {
  it('returns true when both markers are present', () => {
    const readme = `# Title\n${MARKER}\n[![badge](url)](link)\n${MARKER}`;
    expect(hasBadge(readme)).toBe(true);
  });

  it('returns false when no marker present', () => {
    expect(hasBadge('# Title\n\nNo badge here')).toBe(false);
  });

  it('returns false for partial marker', () => {
    expect(hasBadge(`# Title\n${MARKER}\nNo closing marker`)).toBe(false);
  });
});

describe('formatBadge', () => {
  it('contains the correct docs URL', () => {
    const badge = formatBadge('yusukensanta', 'my-project');
    expect(badge).toContain('https://yusukensanta.github.io/projects/my-project/');
  });

  it('wraps content in portfolio-badge markers', () => {
    const badge = formatBadge('yusukensanta', 'repo');
    const lines = badge.split('\n');
    expect(lines[0]).toBe(MARKER);
    expect(lines[lines.length - 1]).toBe(MARKER);
  });

  it('contains a shields.io badge image', () => {
    const badge = formatBadge('yusukensanta', 'repo');
    expect(badge).toContain('shields.io');
  });
});

describe('injectBadge', () => {
  it('inserts badge block after the first line', () => {
    const readme = '# My Project\n\nSome description here.';
    const result = injectBadge(readme, 'yusukensanta', 'my-project');
    const lines = result.split('\n');
    expect(lines[0]).toBe('# My Project');
    expect(result).toContain(MARKER);
    expect(result).toContain('Some description here.');
  });

  it('updates existing badge block, not duplicates it', () => {
    const old = formatBadge('yusukensanta', 'old-slug');
    const readme = `# Title\n${old}\n\nDescription`;
    const result = injectBadge(readme, 'yusukensanta', 'new-slug');
    expect(result).toContain('new-slug');
    expect(result).not.toContain('old-slug');
    const markerCount = (result.match(new RegExp(MARKER, 'g')) ?? []).length;
    expect(markerCount).toBe(2);
  });

  it('handles readme with no newline after first line', () => {
    const readme = '# Title';
    const result = injectBadge(readme, 'user', 'repo');
    expect(result).toContain(MARKER);
    expect(result).toContain('# Title');
  });

  it('handles readme that starts with no heading', () => {
    const readme = 'Plain text readme\n\nMore content';
    const result = injectBadge(readme, 'user', 'repo');
    expect(result).toContain(MARKER);
    expect(result).toContain('Plain text readme');
  });
});
```

- [ ] **Step 2: Run tests — verify they all fail**

```bash
pnpm test
```

Expected: `FAIL` (module not found).

- [ ] **Step 3: Implement `scripts/badge-utils.mjs`**

```js
const MARKER = '<!-- portfolio-badge -->';

/**
 * Returns true if the readme already contains portfolio-badge markers.
 *
 * @param {string} readme
 * @returns {boolean}
 */
export function hasBadge(readme) {
  const count = (readme.match(new RegExp(MARKER, 'g')) ?? []).length;
  return count >= 2;
}

/**
 * Format the full badge block (marker + shield + marker).
 *
 * @param {string} username  GitHub username
 * @param {string} slug      Repo name / project slug
 * @returns {string}
 */
export function formatBadge(username, slug) {
  const url = `https://${username}.github.io/projects/${slug}/`;
  const imgUrl = `https://img.shields.io/badge/docs-${username}.github.io-blue?style=flat%E2%80%93square`;
  const badge = `[![Portfolio Docs](${imgUrl})](${url})`;
  return `${MARKER}\n${badge}\n${MARKER}`;
}

/**
 * Inject or update the badge block in a README string.
 * Inserts after the first line when adding; replaces the existing block when updating.
 *
 * @param {string} readme
 * @param {string} username
 * @param {string} slug
 * @returns {string}
 */
export function injectBadge(readme, username, slug) {
  const block = formatBadge(username, slug);

  if (hasBadge(readme)) {
    const regex = new RegExp(`${MARKER}[\\s\\S]*?${MARKER}`);
    return readme.replace(regex, block);
  }

  const newlineIndex = readme.indexOf('\n');
  if (newlineIndex === -1) {
    return `${readme}\n\n${block}`;
  }
  return `${readme.slice(0, newlineIndex + 1)}\n${block}\n${readme.slice(newlineIndex + 1)}`;
}
```

- [ ] **Step 4: Run all tests — verify all pass**

```bash
pnpm test
```

Expected: all tests `PASS`.

- [ ] **Step 5: Commit**

```bash
git add scripts/badge-utils.mjs scripts/__tests__/badge-utils.test.mjs
git commit -m "feat: add badge injection utilities with tests"
```

---

## Task 10: Sync Orchestrator Script

**Files:**
- Create: `scripts/sync-projects.mjs`

- [ ] **Step 1: Create `scripts/sync-projects.mjs`**

```js
import { Octokit } from '@octokit/rest';
import yaml from 'js-yaml';
import { mkdir, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { extractOverview, extractInstallation, extractSections, findSection } from './markdown-utils.mjs';
import { hasBadge, injectBadge } from './badge-utils.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONTENT_DIR = join(__dirname, '..', 'src', 'content', 'projects');
const USERNAME = process.env.GITHUB_USERNAME ?? 'yusukensanta';

async function main() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.error('Error: GITHUB_TOKEN environment variable is required.');
    process.exit(1);
  }

  const octokit = new Octokit({ auth: token });
  await mkdir(CONTENT_DIR, { recursive: true });

  const repos = await octokit.paginate(octokit.rest.repos.listForUser, {
    username: USERNAME,
    type: 'owner',
    per_page: 100,
  });

  const synced = [];

  for (const repo of repos) {
    if (repo.fork || repo.archived) continue;
    if (repo.name === `${USERNAME}.github.io`) continue;

    const config = await fetchPortfolioConfig(octokit, USERNAME, repo.name);
    if (!config || config.enabled === false) continue;

    console.log(`Syncing ${repo.name}...`);

    const readme = await fetchFile(octokit, USERNAME, repo.name, 'README.md');
    const contributing = await fetchFile(octokit, USERNAME, repo.name, 'CONTRIBUTING.md');
    const changelog = await fetchFile(octokit, USERNAME, repo.name, 'CHANGELOG.md');

    const projectData = buildProjectData(repo, config, readme, contributing, changelog);

    await writeFile(
      join(CONTENT_DIR, `${repo.name}.json`),
      JSON.stringify(projectData, null, 2),
      'utf-8',
    );

    if (readme) {
      await maybeInjectBadge(octokit, USERNAME, repo.name, readme, repo.name);
    }

    synced.push(repo.name);
    console.log(`  ✓ ${repo.name}`);
  }

  console.log(`\nDone. Synced ${synced.length} project(s): ${synced.join(', ') || '(none)'}`);
}

function buildProjectData(repo, config, readme, contributing, changelog) {
  const readmeSections = readme ? extractSections(readme) : {};

  return {
    title: config.title ?? repo.name,
    slug: repo.name,
    description: config.description ?? repo.description ?? '',
    repo: `${USERNAME}/${repo.name}`,
    stars: repo.stargazers_count ?? 0,
    forks: repo.forks_count ?? 0,
    homepage: config.homepage ?? repo.homepage ?? null,
    tech_stack: config.tech_stack ?? [],
    last_updated: repo.pushed_at ?? new Date().toISOString(),
    sections: {
      readme: readme ? extractOverview(readme) : '',
      installation: readme ? extractInstallation(readme) : '',
      contributing: contributing ?? '',
      changelog: changelog
        ? findSection(extractSections(changelog), ['unreleased', 'changelog', '__preamble__']) || changelog
        : '',
    },
  };
}

async function fetchPortfolioConfig(octokit, owner, repo) {
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: '.github/portfolio.yml',
    });
    const content = Buffer.from(data.content, 'base64').toString('utf-8');
    return yaml.load(content) ?? {};
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

async function fetchFile(octokit, owner, repo, path) {
  try {
    const { data } = await octokit.rest.repos.getContent({ owner, repo, path });
    if (data.encoding !== 'base64') return null;
    return Buffer.from(data.content, 'base64').toString('utf-8');
  } catch (err) {
    if (err.status === 404) return null;
    throw err;
  }
}

async function maybeInjectBadge(octokit, owner, repo, currentReadme, slug) {
  if (hasBadge(currentReadme)) return;

  const newContent = injectBadge(currentReadme, owner, slug);

  const { data: fileData } = await octokit.rest.repos.getContent({
    owner,
    repo,
    path: 'README.md',
  });

  await octokit.rest.repos.createOrUpdateFileContents({
    owner,
    repo,
    path: 'README.md',
    message: 'docs: add portfolio docs badge [skip ci]',
    content: Buffer.from(newContent).toString('base64'),
    sha: fileData.sha,
  });

  console.log(`  → Injected badge into ${repo}/README.md`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Verify script runs (dry run with a real token)**

If you have a PAT available locally:

```bash
GITHUB_TOKEN=<your-pat> GITHUB_USERNAME=yusukensanta node scripts/sync-projects.mjs
```

Expected: console output listing any repos with `.github/portfolio.yml`, JSON files written to `src/content/projects/`.

If no PAT available yet, skip this and verify in CI (Task 11).

- [ ] **Step 3: Commit**

```bash
git add scripts/sync-projects.mjs
git commit -m "feat: add sync-projects orchestrator script"
```

---

## Task 11: GitHub Actions Workflow

**Files:**
- Create: `.github/workflows/sync-and-deploy.yml`

**Prerequisite:** Create a fine-grained PAT (or classic PAT with `repo` scope) in your GitHub account settings, then add it as a repository secret named `PORTFOLIO_PAT` on the `yusukensanta.github.io` repo. The default `GITHUB_TOKEN` cannot write to other repos.

- [ ] **Step 1: Enable GitHub Pages on the repo**

Go to `https://github.com/yusukensanta/yusukensanta.github.io` → Settings → Pages → Source: **GitHub Actions**.

- [ ] **Step 2: Create `.github/workflows/sync-and-deploy.yml`**

```yaml
name: Sync and Deploy

on:
  schedule:
    - cron: '0 2 * * *'       # nightly at 02:00 UTC
  push:
    branches: [main]
  workflow_dispatch:            # manual trigger

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  sync-and-deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 10

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run tests
        run: pnpm test

      - name: Sync project data from GitHub
        env:
          GITHUB_TOKEN: ${{ secrets.PORTFOLIO_PAT }}
          GITHUB_USERNAME: yusukensanta
        run: pnpm sync

      - name: Build Astro site
        run: pnpm build

      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: ./dist

      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 3: Commit and push to trigger first deploy**

```bash
git add .github/workflows/sync-and-deploy.yml
git commit -m "ci: add sync-and-deploy GitHub Actions workflow"
git push origin main
```

- [ ] **Step 4: Verify workflow run**

Go to `https://github.com/yusukensanta/yusukensanta.github.io/actions` — watch the workflow run. Expected: all steps pass, site deployed to `https://yusukensanta.github.io`.

---

## Task 12: Portfolio Template

**Files:**
- Create: `.github/portfolio.yml.template`

- [ ] **Step 1: Create `.github/portfolio.yml.template`**

This is the file other repo owners copy to `.github/portfolio.yml` to opt in.

```yaml
# Portfolio opt-in configuration for yusukensanta.github.io
# Copy this file to .github/portfolio.yml in your repository.

# Set to false to temporarily remove from the portfolio without deleting this file.
enabled: true

# Override the display title (defaults to repository name)
# title: "My Awesome Project"

# Override the description (defaults to GitHub repository description)
# description: "A short description shown on the index and project pages."

# Link to a live demo or production deployment (optional)
# homepage: "https://example.com"

# Tech stack tags shown on the project card and detail page (optional)
# tech_stack:
#   - Python
#   - FastAPI
#   - PostgreSQL
```

- [ ] **Step 2: Commit**

```bash
git add .github/portfolio.yml.template
git commit -m "docs: add portfolio.yml template for project opt-in"
```

---

## Post-Implementation: Opt In a Repo

To opt in one of your other repositories:

1. Copy `.github/portfolio.yml.template` → `.github/portfolio.yml` in the target repo
2. Uncomment and fill in the fields you want to customize
3. Trigger a workflow run: push to `main` on `yusukensanta.github.io`, or go to Actions → "Sync and Deploy" → "Run workflow"

The sync script will:
- Pull README / CONTRIBUTING / CHANGELOG from the repo
- Write `src/content/projects/{repo-name}.json`
- Inject the portfolio badge into the repo's README (one-time, via API commit)

---

## Self-Review

### Spec Coverage

| Requirement | Task |
|-------------|------|
| github.io page listing OSS projects | Task 5 (index page) |
| Dynamic display from other repos | Task 10 (sync script) + Task 11 (workflow) |
| `.github/portfolio.yml` opt-in | Task 10, Task 12 |
| Per-project pages: overview, installation, contributing, changelog | Task 7, Task 8 |
| Auto-badge injection back to source repos | Task 9, Task 10 |
| Nightly + on-push refresh | Task 11 |
| Tests (≥80% coverage on business logic) | Tasks 8, 9 |

### Type Consistency Check

- `Project` type defined in `src/content/config.ts` (Task 2), used in Tasks 5, 6, 7 — consistent.
- `project.sections.readme/installation/contributing/changelog` — defined in schema, accessed same way in `[slug].astro`.
- `extractSections()` returns `Record<string, string>` — consumed correctly by `findSection()`.
- `formatBadge(username, slug)` — called as `formatBadge(owner, slug)` in `injectBadge` — consistent.

### No Placeholder Scan

No TBDs, no "implement later", no "similar to Task N" patterns — all steps contain working code.
