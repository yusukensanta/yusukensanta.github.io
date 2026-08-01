import { describe, it, expect } from 'vitest';
import { toLocalePath } from '../paths';

describe('toLocalePath', () => {
  it('adds the /ja prefix to the root path', () => {
    expect(toLocalePath('/', 'ja')).toBe('/ja/');
  });

  it('strips the /ja prefix for the root path', () => {
    expect(toLocalePath('/ja/', 'en')).toBe('/');
  });

  it('adds the /ja prefix to a project path', () => {
    expect(toLocalePath('/projects/foo/', 'ja')).toBe('/ja/projects/foo/');
  });

  it('strips the /ja prefix from a project path', () => {
    expect(toLocalePath('/ja/projects/foo/', 'en')).toBe('/projects/foo/');
  });

  it('handles nested project subpages in both directions', () => {
    expect(toLocalePath('/projects/foo/installation/', 'ja')).toBe('/ja/projects/foo/installation/');
    expect(toLocalePath('/ja/projects/foo/installation/', 'en')).toBe('/projects/foo/installation/');
  });

  it('is a no-op when already at the requested locale', () => {
    expect(toLocalePath('/', 'en')).toBe('/');
    expect(toLocalePath('/ja/', 'ja')).toBe('/ja/');
    expect(toLocalePath('/projects/foo/', 'en')).toBe('/projects/foo/');
  });
});
