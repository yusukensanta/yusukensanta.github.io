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
    const version = await fetchLatestRelease(octokit, USERNAME, repo.name);

    const projectData = buildProjectData(repo, config, readme, contributing, changelog, version);

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

function rewriteImageUrls(content, owner, repo, branch = 'main') {
  if (!content) return content;
  const base = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/`;
  return content
    .replace(/src="(?!https?:\/\/)([^"]+)"/g, (_, p) => `src="${base}${p}"`)
    .replace(/srcset="(?!https?:\/\/)([^"]+)"/g, (_, p) => `srcset="${base}${p}"`);
}

function extractLogo(content) {
  if (!content) return { logo: null, logo_dark: null };
  const pictureMatch = content.match(/<picture[\s\S]*?<\/picture>/i);
  if (pictureMatch) {
    const block = pictureMatch[0];
    const darkMatch = block.match(/srcset="([^"]+)"/);
    const imgMatch = block.match(/src="([^"]+)"/);
    return {
      logo: imgMatch?.[1] ?? null,
      logo_dark: darkMatch?.[1] ?? null,
    };
  }
  const imgMatch = content.match(/<img[^>]+src="([^"]+)"/i);
  return { logo: imgMatch?.[1] ?? null, logo_dark: null };
}

// Remove <p> blocks that contain a <picture> element (logo).
// Keeps the prose clean when logo is already displayed in ProjectHeader.
function stripLogoBlock(content) {
  if (!content) return content;
  return content
    .replace(/<p[^>]*>[\s\S]*?<picture[\s\S]*?<\/picture>[\s\S]*?<\/p>\s*/gi, '')
    .trimStart();
}

function buildProjectData(repo, config, readme, contributing, changelog, version) {
  const rewrittenReadme = rewriteImageUrls(readme, USERNAME, repo.name);
  const { logo, logo_dark } = extractLogo(rewrittenReadme);

  return {
    title: config.title ?? repo.name,
    slug: repo.name,
    description: config.description ?? repo.description ?? '',
    repo: `${USERNAME}/${repo.name}`,
    stars: repo.stargazers_count ?? 0,
    forks: repo.forks_count ?? 0,
    homepage: config.homepage ?? repo.homepage ?? null,
    logo: config.logo ?? logo,
    logo_dark: config.logo_dark ?? logo_dark,
    tech_stack: config.tech_stack ?? [],
    version: version ?? null,
    last_updated: repo.pushed_at ?? new Date().toISOString(),
    sections: {
      readme: rewrittenReadme ? stripLogoBlock(extractOverview(rewrittenReadme)) : '',
      installation: rewrittenReadme ? extractInstallation(rewrittenReadme) : '',
      contributing: rewriteImageUrls(contributing, USERNAME, repo.name) ?? '',
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
    if (data.encoding !== 'base64') return null;
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

async function fetchLatestRelease(octokit, owner, repo) {
  try {
    const { data } = await octokit.rest.repos.getLatestRelease({ owner, repo });
    return data.tag_name;
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
