import type { Locale } from './paths';

export const ui = {
  en: {
    'nav.github': 'GitHub',
    'nav.home': '← Home',
    'nav.overview': 'Overview',
    'nav.installation': 'Installation',
    'nav.contributing': 'Contributing',
    'nav.lang': '日本語',
    'aria.projectSections': 'Project sections',
    'aria.socialLinks': 'Social links',
    'aria.techStack': 'Tech stack',
    'aria.projectLinks': '{title} links',
    'footer.built': 'Built with {astroLink} · Auto-synced from GitHub',
    'profile.bio': 'Software engineer. Building open source tools.',
    'projects.heading': 'Projects',
    'projects.empty': 'No projects synced yet — run {cmd1} or {cmd2}.',
    'links.install': 'Install',
    'links.contribute': 'Contribute',
    'links.demo': 'Demo ↗',
    'links.liveDemo': 'Live Demo ↗',
    'meta.forks': '{count} forks',
    'meta.updated': 'Updated {date}',
    'meta.installDescription': 'How to install {title}',
    'meta.contributeDescription': 'How to contribute to {title}',
    'projects.noOverview': 'No overview available.',
  },
  ja: {
    'nav.github': 'GitHub',
    'nav.home': '← ホーム',
    'nav.overview': '概要',
    'nav.installation': 'インストール',
    'nav.contributing': 'コントリビュート',
    'nav.lang': 'English',
    'aria.projectSections': 'プロジェクトセクション',
    'aria.socialLinks': 'ソーシャルリンク',
    'aria.techStack': '技術スタック',
    'aria.projectLinks': '{title} のリンク',
    'footer.built': '{astroLink} で構築 · GitHub から自動同期',
    'profile.bio': 'ソフトウェアエンジニア。オープンソースツールを開発しています。',
    'projects.heading': 'プロジェクト',
    'projects.empty': '同期済みのプロジェクトはまだありません。{cmd1} または {cmd2} を実行してください。',
    'links.install': 'インストール',
    'links.contribute': 'コントリビュート',
    'links.demo': 'デモ ↗',
    'links.liveDemo': 'ライブデモ ↗',
    'meta.forks': '{count} フォーク',
    'meta.updated': '{date} 更新',
    'meta.installDescription': '{title} のインストール方法',
    'meta.contributeDescription': '{title} への貢献方法',
    'projects.noOverview': '概要はありません。',
  },
} as const satisfies Record<Locale, Record<string, string>>;

export type UiKey = keyof typeof ui['en'];

export function t(locale: Locale, key: UiKey): string {
  return ui[locale][key];
}

/**
 * Splits `template` around each placeholder in `placeholders`, in order,
 * so callers can render markup or dynamic values between the pieces
 * without assuming any particular word order.
 */
export function splitTemplate(template: string, ...placeholders: string[]): string[] {
  let parts = [template];
  for (const placeholder of placeholders) {
    const last = parts.pop() as string;
    parts.push(...last.split(placeholder));
  }
  return parts;
}
