import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      'luckysheet': fileURLToPath(new URL('../../src/index.esm.js', import.meta.url)),
    },
  },
  assetsInclude: ['**/*.woff2', '**/*.ttf', '**/*.eot', '**/*.svg', '**/*.gif', '**/*.png'],
});
