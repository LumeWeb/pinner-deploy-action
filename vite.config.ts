import { defineConfig } from 'vite-plus'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  lint: {
    plugins: ['oxc', 'typescript', 'unicorn', 'react', 'import'],
    jsPlugins: [
      {
        name: 'vite-plus',
        specifier: 'vite-plus/oxlint-plugin'
      }
    ],
    categories: {
      correctness: 'warn'
    },
    env: {
      builtin: true,
      es2023: true,
      node: true
    },
    ignorePatterns: ['**/coverage', '**/dist', '**/linter', '**/node_modules'],
    rules: {
      'constructor-super': 'error',
      'for-direction': 'error',
      'getter-return': 'error',
      'no-async-promise-executor': 'error',
      'no-case-declarations': 'error',
      'no-class-assign': 'error',
      'no-compare-neg-zero': 'error',
      'no-cond-assign': 'error',
      'no-const-assign': 'error',
      'no-constant-binary-expression': 'error',
      'no-constant-condition': 'error',
      'no-control-regex': 'error',
      'no-debugger': 'error',
      'no-delete-var': 'error',
      'no-dupe-class-members': 'error',
      'no-dupe-else-if': 'error',
      'no-dupe-keys': 'error',
      'no-duplicate-case': 'error',
      'no-empty': 'error',
      'no-empty-character-class': 'error',
      'no-empty-pattern': 'error',
      'no-empty-static-block': 'error',
      'no-ex-assign': 'error',
      'no-extra-boolean-cast': 'error',
      'no-fallthrough': 'error',
      'no-func-assign': 'error',
      'no-global-assign': 'error',
      'no-import-assign': 'error',
      'no-invalid-regexp': 'error',
      'no-irregular-whitespace': 'error',
      'no-loss-of-precision': 'error',
      'no-misleading-character-class': 'error',
      'no-new-native-nonconstructor': 'error',
      'no-nonoctal-decimal-escape': 'error',
      'no-obj-calls': 'error',
      'no-prototype-builtins': 'error',
      'no-redeclare': 'error',
      'no-regex-spaces': 'error',
      'no-self-assign': 'error',
      'no-setter-return': 'error',
      'no-shadow-restricted-names': 'error',
      'no-sparse-arrays': 'error',
      'no-this-before-super': 'error',
      'no-unassigned-vars': 'error',
      'no-undef': 'error',
      'no-unexpected-multiline': 'error',
      'no-unreachable': 'error',
      'no-unsafe-finally': 'error',
      'no-unsafe-negation': 'error',
      'no-unsafe-optional-chaining': 'error',
      'no-unused-labels': 'error',
      'no-unused-private-class-members': 'error',
      'no-unused-vars': 'error',
      'no-useless-assignment': 'error',
      'no-useless-backreference': 'error',
      'no-useless-catch': 'error',
      'no-useless-escape': 'error',
      'no-with': 'error',
      'preserve-caught-error': 'error',
      'require-yield': 'error',
      'use-isnan': 'error',
      'valid-typeof': 'error',
      'no-array-constructor': 'error',
      'no-unused-expressions': 'error',
      'typescript/ban-ts-comment': 'error',
      'typescript/no-duplicate-enum-values': 'error',
      'typescript/no-empty-object-type': 'error',
      'typescript/no-explicit-any': 'error',
      'typescript/no-extra-non-null-assertion': 'error',
      'typescript/no-misused-new': 'error',
      'typescript/no-namespace': 'error',
      'typescript/no-non-null-asserted-optional-chain': 'error',
      'typescript/no-require-imports': 'error',
      'typescript/no-this-alias': 'error',
      'typescript/no-unnecessary-type-constraint': 'error',
      'typescript/no-unsafe-declaration-merging': 'error',
      'typescript/no-unsafe-function-type': 'error',
      'typescript/no-wrapper-object-types': 'error',
      'typescript/prefer-as-const': 'error',
      'typescript/prefer-namespace-keyword': 'error',
      'typescript/triple-slash-reference': 'error',
      'vite-plus/prefer-vite-plus-imports': 'error'
    },
    overrides: [
      {
        files: ['__tests__/**/*.ts'],
        rules: {
          'typescript/no-explicit-any': 'off'
        }
      }
    ],
    options: {
      typeAware: true,
      typeCheck: true
    }
  },
  fmt: {
    printWidth: 80,
    tabWidth: 2,
    useTabs: false,
    semi: false,
    singleQuote: true,
    quoteProps: 'as-needed',
    jsxSingleQuote: false,
    trailingComma: 'none',
    bracketSpacing: true,
    bracketSameLine: true,
    arrowParens: 'always',
    proseWrap: 'always',
    htmlWhitespaceSensitivity: 'css',
    endOfLine: 'lf',
    sortPackageJson: false,
    ignorePatterns: [
      '.DS_Store',
      '.licenses/',
      '.sisyphus/',
      'dist/',
      'node_modules/',
      'coverage/'
    ]
  },
  test: {
    environment: 'node',
    include: ['__tests__/**/*.test.ts'],
    globals: false
  },
  pack: {
    entry: 'src/index.ts',
    format: 'esm',
    sourcemap: true,
    dts: false,
    fixedExtension: false,
    deps: {
      alwaysBundle: /.*/,
      onlyBundle: false
    },
    outputOptions: {
      codeSplitting: false
    },
    plugins: {
      name: 'inline-create-require-native',
      renderChunk(code) {
        // Bundled modules use createRequire(import.meta.url)("...") to load
        // files relative to their own location at runtime. After bundling,
        // these paths resolve against the output file and break when only
        // dist/ is shipped (GitHub Actions runner).
        let changed = false

        // 1. Inline package.json references (e.g. "../../package.json")
        const jsonRegex =
          /createRequire\([^)]*\)\(\s*["'`]([^"'`]*package\.json)["'`]\s*\)/g
        if (jsonRegex.test(code)) {
          jsonRegex.lastIndex = 0
          code = code.replace(jsonRegex, (match, pkgPath) => {
            try {
              const candidates = [
                pkgPath,
                pkgPath.replace(/^\.\.\//, ''),
                pkgPath.replace(/^\.\.\/\.\.\//, ''),
              ]
              for (const candidate of candidates) {
                try {
                  const resolved = require.resolve(candidate, {
                    paths: [path.resolve(__dirname, 'node_modules')],
                  })
                  const pkg = require(resolved)
                  changed = true
                  return JSON.stringify(pkg)
                } catch {}
              }
              return match
            } catch {
              return match
            }
          })
        }

        // 2. Stub native addon references (e.g. "../../build/Release/foo.node")
        //    These are native binaries that can't be bundled. Replace with a
        //    deep recursive Proxy stub that allows property access (so
        //    top-level destructuring doesn't crash) but throws on invocation.
        const nodeRegex =
          /createRequire\([^)]*\)\(\s*["'`]([^"'`]*\.node)["'`]\s*\)/g
        const stubExpr =
          '(()=>{const s=new Proxy(function(){},{get:(_,p)=>s,apply:()=>{throw new Error("native addon not available in bundled mode")}});return s})()'
        if (nodeRegex.test(code)) {
          nodeRegex.lastIndex = 0
          code = code.replace(nodeRegex, (match) => {
            changed = true
            return stubExpr
          })
        }

        if (!changed) return null
        return { code, map: null }
      },
    },
  }
})
