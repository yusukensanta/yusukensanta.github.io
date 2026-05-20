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
