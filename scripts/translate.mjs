import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const DEEPL_ENDPOINT = 'https://api-free.deepl.com/v2/translate';
const DEFAULT_CACHE_DIR = '.translations-cache';

const FENCED_CODE_RE = /```[\s\S]*?```/g;
const INLINE_CODE_RE = /`[^`\n]+`/g;

/**
 * Replaces fenced and inline code spans with `__CODE_N__` placeholders so
 * they survive a round trip through machine translation unmodified.
 */
export function extractCode(text) {
  const codeBlocks = [];
  let result = text.replace(FENCED_CODE_RE, match => {
    const token = `__CODE_${codeBlocks.length}__`;
    codeBlocks.push(match);
    return token;
  });
  result = result.replace(INLINE_CODE_RE, match => {
    const token = `__CODE_${codeBlocks.length}__`;
    codeBlocks.push(match);
    return token;
  });
  return { text: result, codeBlocks };
}

/** Reverses `extractCode`, restoring original code verbatim. */
export function restoreCode(text, codeBlocks) {
  return codeBlocks.reduce(
    (acc, block, i) => acc.replaceAll(`__CODE_${i}__`, block),
    text,
  );
}

/** SHA-256 hash of the given fields, joined by a NUL separator. */
export function hashContent(fields) {
  return createHash('sha256').update(fields.join(' ')).digest('hex');
}

/**
 * Translates `text` EN → JA via DeepL, protecting code spans first.
 * Empty/whitespace-only text is returned unchanged without an API call.
 */
export async function translateText(text, apiKey, fetchImpl = fetch) {
  if (!text.trim()) return text;

  const { text: placeholdered, codeBlocks } = extractCode(text);

  const response = await fetchImpl(DEEPL_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `DeepL-Auth-Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: [placeholdered],
      source_lang: 'EN',
      target_lang: 'JA',
    }),
  });

  if (!response.ok) {
    throw new Error(`DeepL request failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const translated = data.translations?.[0]?.text ?? '';
  return restoreCode(translated, codeBlocks);
}

/** Reads `<cacheDir>/<repoName>.json`, or null if it doesn't exist. */
export async function readCacheEntry(repoName, cacheDir = DEFAULT_CACHE_DIR) {
  try {
    const raw = await readFile(join(cacheDir, `${repoName}.json`), 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

/** Writes `<cacheDir>/<repoName>.json`, creating the directory if needed. */
export async function writeCacheEntry(repoName, entry, cacheDir = DEFAULT_CACHE_DIR) {
  await mkdir(cacheDir, { recursive: true });
  await writeFile(join(cacheDir, `${repoName}.json`), JSON.stringify(entry, null, 2), 'utf-8');
}

/**
 * Returns `{ ja: {...} }` for a repo's project data, reusing the cache
 * when the EN source is unchanged, translating via DeepL otherwise.
 * Returns the stale cached entry (if any) without calling DeepL when
 * `apiKey` is falsy, or `undefined` if there's neither a key nor a cache.
 */
export async function buildTranslations(repoName, projectData, apiKey, options = {}) {
  const { fetchImpl = fetch, cacheDir = DEFAULT_CACHE_DIR } = options;

  const fields = [
    projectData.title,
    projectData.description,
    projectData.sections.readme,
    projectData.sections.installation,
    projectData.sections.contributing,
  ];
  const sourceHash = hashContent(fields);
  const cached = await readCacheEntry(repoName, cacheDir);

  if (cached?.source_hash === sourceHash) {
    return { ja: cached };
  }

  if (!apiKey) {
    console.warn(`  ⚠ DEEPL_API_KEY not set — skipping Japanese translation for ${repoName}`);
    return cached ? { ja: cached } : undefined;
  }

  const [title, description, readme, installation, contributing] = await Promise.all(
    fields.map(field => translateText(field, apiKey, fetchImpl)),
  );

  const entry = {
    source_hash: sourceHash,
    title,
    description,
    sections: { readme, installation, contributing },
  };

  await writeCacheEntry(repoName, entry, cacheDir);
  return { ja: entry };
}
