import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import vue from 'eslint-plugin-vue';
import reactHooks from 'eslint-plugin-react-hooks';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

/** Vue 端这些 API 由 unplugin-auto-import 自动注入，不需要手写 import */
const autoImports = {
  ref: 'readonly',
  computed: 'readonly',
  watch: 'readonly',
  reactive: 'readonly',
  toRefs: 'readonly',
  onMounted: 'readonly',
  onUnmounted: 'readonly',
  nextTick: 'readonly',
};

export default tseslint.config(
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/auto-imports.d.ts', '**/components.d.ts'],
  },

  // 通用规则
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Vue 应用
  ...vue.configs['flat/recommended'],
  {
    files: ['apps/vue/**/*.{ts,vue}'],
    languageOptions: {
      globals: { ...globals.browser, ...autoImports },
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.vue'],
        sourceType: 'module',
      },
    },
    rules: {
      // App.vue / HomePage.vue 这类单词组件名在本项目是常态
      'vue/multi-word-component-names': 'off',
    },
  },

  // React 应用
  {
    files: ['apps/react/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: { ...reactHooks.configs.recommended.rules },
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },

  // core / theme / 配置文件：纯 TS，跑在 Node 里
  {
    files: ['packages/**/*.ts', 'vitest.config.ts', 'eslint.config.js'],
    languageOptions: { globals: { ...globals.node } },
  },

  // 放在最后：关掉所有和 Prettier 冲突的格式规则
  prettier,
);
