export type Locale = 'en' | 'ja';

/**
 * Returns `pathname` rewritten for `locale`, adding or stripping the
 * `/ja` prefix as needed. `pathname` may already carry either locale's
 * prefix (or none, meaning English).
 */
export function toLocalePath(pathname: string, locale: Locale): string {
  const stripped = pathname === '/ja' || pathname.startsWith('/ja/')
    ? pathname.slice(3) || '/'
    : pathname;

  if (locale === 'en') return stripped;
  return stripped === '/' ? '/ja/' : `/ja${stripped}`;
}
