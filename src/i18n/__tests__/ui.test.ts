import { describe, it, expect } from 'vitest';
import { t, splitTemplate, ui } from '../ui';

describe('t', () => {
  it('returns the English string for an en key', () => {
    expect(t('en', 'nav.overview')).toBe('Overview');
  });

  it('returns the Japanese string for a ja key', () => {
    expect(t('ja', 'nav.overview')).toBe('概要');
  });

  it('has the same set of keys for both locales', () => {
    expect(Object.keys(ui.ja).sort()).toEqual(Object.keys(ui.en).sort());
  });
});

describe('splitTemplate', () => {
  it('splits a template around a single placeholder', () => {
    expect(splitTemplate('Built with {astroLink} · rest', '{astroLink}')).toEqual([
      'Built with ',
      ' · rest',
    ]);
  });

  it('splits a template around multiple placeholders in order', () => {
    expect(splitTemplate('run {cmd1} or {cmd2}.', '{cmd1}', '{cmd2}')).toEqual([
      'run ',
      ' or ',
      '.',
    ]);
  });

  it('supports Japanese word order with the same placeholder tokens', () => {
    expect(splitTemplate('{astroLink} で構築', '{astroLink}')).toEqual(['', ' で構築']);
  });
});
