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
