import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://yusukensanta.github.io',
  output: 'static',
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'ja'],
    routing: {
      prefixDefaultLocale: false,
    },
  },
});
