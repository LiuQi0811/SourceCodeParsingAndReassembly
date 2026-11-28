import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // core 是纯 TS，不需要任何框架环境
    include: ['packages/*/src/**/*.test.ts'],
    environment: 'node',
  },
});
