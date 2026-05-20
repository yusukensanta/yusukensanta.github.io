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
  const imgUrl = `https://img.shields.io/badge/docs-${username}.github.io-blue?style=flat-square`;
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
