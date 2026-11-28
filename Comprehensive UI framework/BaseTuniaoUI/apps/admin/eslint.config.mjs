import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import pluginVue from 'eslint-plugin-vue'
import prettier from 'eslint-config-prettier'

export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'src/static/**',
      'src/uni_modules/**',
      'src/pages.json',
      'test-results/**',
      'playwright-report/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/essential'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: { parser: tseslint.parser },
    },
  },
  {
    languageOptions: {
      globals: {
        uni: 'readonly',
        wx: 'readonly',
        getApp: 'readonly',
        getCurrentPages: 'readonly',
        plus: 'readonly',
      },
    },
    rules: {
      // 单文件页面组件按业务命名，不强制多词
      'vue/multi-word-component-names': 'off',
      // 表格/动态数据天然是 any，这里不做惩罚
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      // 请求层与 mock 里有意留空 catch
      'no-empty': ['warn', { allowEmptyCatch: true }],
    },
  },
  {
    files: ['e2e/**/*.ts', 'playwright.config.ts'],
    languageOptions: {
      globals: {
        window: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        process: 'readonly',
      },
    },
  },
  // 关闭与 prettier 冲突的格式类规则，格式统一交给 prettier
  prettier,
]
