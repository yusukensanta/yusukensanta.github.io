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
