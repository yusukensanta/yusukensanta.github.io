import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const DEFAULT_CACHE_DIR = '.translations-cache';

/**
 * DeepL's Developer (free-tier) API key grants 1,000,000 characters
 * TOTAL, for the lifetime of the key — it does not reset monthly. A
 * single oversized field (e.g. a long README) could burn a large slice
 * of that budget in one call, so fields longer than this are skipped
 * (left untranslated, falling back to English) rather than sent to DeepL.
 */
export const DEFAULT_MAX_CHARS_PER_FIELD = 5000;

const FENCED_CODE_RE = /```[\s\S]*?```/g;
const INLINE_CODE_RE = /`[^`\n]+`/g;
const LEFTOVER_PLACEHOLDER_RE = /__CODE_\d+__/;

/**
 * DeepL free-tier API keys are suffixed with `:fx` and must use the free
 * host; Pro keys use the standard host and get a 403 from the free one.
 */
function deeplEndpoint(apiKey) {
  const host = apiKey?.endsWith(':fx') ? 'api-free.deepl.com' : 'api.deepl.com';
  return `https://${host}/v2/translate`;
}

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
    // Use a function replacer, not a string, so `block` is never interpreted
    // as a $$-style replacement pattern by String.prototype.replaceAll.
    (acc, block, i) => acc.replaceAll(`__CODE_${i}__`, () => block),
    text,
  );
}

/** SHA-256 hash of the given fields, joined by a NUL separator. */
export function hashContent(fields) {
  return createHash('sha256').update(fields.join('\0')).digest('hex');
}

/**
 * Translates `text` EN → JA via DeepL, protecting code spans first.
 * Empty/whitespace-only text is returned unchanged without an API call.
 * Text longer than `maxChars` is also returned unchanged without an API
 * call, to avoid a single large field spending a big slice of DeepL's
 * non-renewing character budget.
 */
export async function translateText(text, apiKey, fetchImpl = fetch, maxChars = DEFAULT_MAX_CHARS_PER_FIELD) {
  if (!text.trim()) return text;

  if (text.length > maxChars) {
    console.warn(
      `  ⚠ Text is ${text.length} chars, over the ${maxChars}-char cap — skipping translation to conserve the DeepL character budget.`,
    );
    return text;
  }

  const { text: placeholdered, codeBlocks } = extractCode(text);

  const response = await fetchImpl(deeplEndpoint(apiKey), {
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
  const restored = restoreCode(translated, codeBlocks);

  if (LEFTOVER_PLACEHOLDER_RE.test(restored)) {
    console.warn(
      '  ⚠ Translation contained a mangled code placeholder — falling back to English source text.',
    );
    return text;
  }

  return restored;
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
  const {
    fetchImpl = fetch,
    cacheDir = DEFAULT_CACHE_DIR,
    maxChars = DEFAULT_MAX_CHARS_PER_FIELD,
  } = options;

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
    fields.map(field => translateText(field, apiKey, fetchImpl, maxChars)),
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
