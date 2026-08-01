import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  extractCode,
  restoreCode,
  hashContent,
  translateText,
  readCacheEntry,
  writeCacheEntry,
  buildTranslations,
} from '../translate.mjs';

describe('extractCode / restoreCode', () => {
  it('extracts fenced code blocks and restores them verbatim', () => {
    const text = 'Run this:\n```bash\nnpm install\n```\nThen go.';
    const { text: placeholdered, codeBlocks } = extractCode(text);
    expect(placeholdered).not.toContain('npm install');
    expect(codeBlocks).toHaveLength(1);
    expect(restoreCode(placeholdered, codeBlocks)).toBe(text);
  });

  it('extracts inline code spans and restores them verbatim', () => {
    const text = 'Run `pnpm install` to set up.';
    const { text: placeholdered, codeBlocks } = extractCode(text);
    expect(placeholdered).not.toContain('pnpm install');
    expect(restoreCode(placeholdered, codeBlocks)).toBe(text);
  });

  it('handles multiple fenced blocks and inline spans together', () => {
    const text = '`a` then\n```js\nconst b = 1;\n```\nand `c`.';
    const { text: placeholdered, codeBlocks } = extractCode(text);
    expect(codeBlocks).toHaveLength(3);
    expect(restoreCode(placeholdered, codeBlocks)).toBe(text);
  });

  it('leaves text with no code untouched', () => {
    const text = 'Just plain prose, no code here.';
    const { text: placeholdered, codeBlocks } = extractCode(text);
    expect(placeholdered).toBe(text);
    expect(codeBlocks).toHaveLength(0);
  });
});

describe('hashContent', () => {
  it('produces the same hash for the same fields', () => {
    expect(hashContent(['a', 'b'])).toBe(hashContent(['a', 'b']));
  });

  it('produces a different hash when a field changes', () => {
    expect(hashContent(['a', 'b'])).not.toBe(hashContent(['a', 'c']));
  });
});

describe('translateText', () => {
  it('sends code-placeholdered text to DeepL and restores code in the response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ translations: [{ text: '実行: __CODE_0__' }] }),
    });
    const result = await translateText('Run `pnpm install`', 'fake-key', fetchImpl);
    expect(result).toBe('実行: `pnpm install`');
    const [, init] = fetchImpl.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.text[0]).not.toContain('pnpm install');
  });

  it('returns empty/whitespace text unchanged without calling DeepL', async () => {
    const fetchImpl = vi.fn();
    const result = await translateText('   ', 'fake-key', fetchImpl);
    expect(result).toBe('   ');
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('throws when DeepL responds with a non-OK status', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 456, statusText: 'Quota Exceeded' });
    await expect(translateText('hello', 'fake-key', fetchImpl)).rejects.toThrow('456');
  });
});

describe('cache read/write', () => {
  let cacheDir;
  beforeEach(async () => {
    cacheDir = await mkdtemp(join(tmpdir(), 'translations-cache-'));
  });
  afterEach(async () => {
    await rm(cacheDir, { recursive: true, force: true });
  });

  it('returns null when no cache entry exists', async () => {
    expect(await readCacheEntry('missing-repo', cacheDir)).toBeNull();
  });

  it('round-trips a written cache entry', async () => {
    const entry = {
      source_hash: 'abc',
      title: 'タイトル',
      description: '',
      sections: { readme: '', installation: '', contributing: '' },
    };
    await writeCacheEntry('demo-cli', entry, cacheDir);
    expect(await readCacheEntry('demo-cli', cacheDir)).toEqual(entry);
  });
});

describe('buildTranslations', () => {
  let cacheDir;
  beforeEach(async () => {
    cacheDir = await mkdtemp(join(tmpdir(), 'translations-cache-'));
  });
  afterEach(async () => {
    await rm(cacheDir, { recursive: true, force: true });
  });

  const projectData = {
    title: 'demo-cli',
    description: 'A sample CLI tool.',
    sections: {
      readme: 'Overview text.',
      installation: 'npm install demo-cli',
      contributing: 'Open a PR.',
    },
  };

  it('translates and caches when there is no prior cache entry', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ translations: [{ text: '翻訳済み' }] }),
    });
    const result = await buildTranslations('demo-cli', projectData, 'fake-key', { fetchImpl, cacheDir });
    expect(result.ja.title).toBe('翻訳済み');
    expect(fetchImpl).toHaveBeenCalledTimes(5);
    expect(await readCacheEntry('demo-cli', cacheDir)).toEqual(result.ja);
  });

  it('reuses the cache and skips DeepL when content is unchanged', async () => {
    const cached = {
      source_hash: hashContent([
        projectData.title,
        projectData.description,
        projectData.sections.readme,
        projectData.sections.installation,
        projectData.sections.contributing,
      ]),
      title: '翻訳済み',
      description: '説明',
      sections: { readme: '概要', installation: 'インストール', contributing: '貢献' },
    };
    await writeCacheEntry('demo-cli', cached, cacheDir);
    const fetchImpl = vi.fn();
    const result = await buildTranslations('demo-cli', projectData, 'fake-key', { fetchImpl, cacheDir });
    expect(result).toEqual({ ja: cached });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('re-translates when content changed since the cached hash', async () => {
    await writeCacheEntry('demo-cli', { source_hash: 'stale-hash', title: 'old' }, cacheDir);
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ translations: [{ text: 'new translation' }] }),
    });
    const result = await buildTranslations('demo-cli', projectData, 'fake-key', { fetchImpl, cacheDir });
    expect(result.ja.title).toBe('new translation');
    expect(fetchImpl).toHaveBeenCalled();
  });

  it('falls back to cached translations without calling DeepL when the API key is missing', async () => {
    const cached = {
      source_hash: 'some-hash',
      title: '古い翻訳',
      description: '',
      sections: { readme: '', installation: '', contributing: '' },
    };
    await writeCacheEntry('demo-cli', cached, cacheDir);
    const fetchImpl = vi.fn();
    const result = await buildTranslations('demo-cli', projectData, undefined, { fetchImpl, cacheDir });
    expect(result).toEqual({ ja: cached });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('returns undefined when the API key is missing and there is no cache', async () => {
    const fetchImpl = vi.fn();
    const result = await buildTranslations('demo-cli', projectData, undefined, { fetchImpl, cacheDir });
    expect(result).toBeUndefined();
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
