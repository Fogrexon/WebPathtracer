import babel from '@rollup/plugin-babel';
import postcss from 'rollup-plugin-postcss';
import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import { base64 } from 'rollup-plugin-base64';
import { terser } from 'rollup-plugin-terser';

import packageJson from './package.json';

const extensions = ['.ts', '.js'];

const banner = `
  /**
   * @license
   * ${packageJson.moduleName}.js v${packageJson.version}
   * Released under the ${packageJson.license} License.
   */
`;

export default [

  {
    input: 'src/index.ts',

    preserveModules: true,

    output: {
      dir: 'build/commonjs',
      format: 'cjs',
      exports: 'named',
      banner,
      sourcemap: true,
    },

    plugins: [
      nodeResolve({browser: true}),
      postcss({
        extract: true,
      }),
      babel({
        extensions,
      }),
      typescript({
        declaration: true,
        rootDir: 'src',
        declarationDir: 'build/commonjs/src',
      }),
      base64({ include: "**/*.wasm" }),
    ],
  },

  {
    input: 'src/index.ts',
    preserveModules: true,
    output: {
      dir: 'build/es',
      format: 'es',
      exports: 'named',
      banner,
      sourcemap: true,
    },

    plugins: [
      nodeResolve({browser: true}),
      postcss({
        extract: true,
      }),
      babel({
        extensions,
      }),
      typescript({
        declaration: true,
        rootDir: 'src',
        declarationDir: 'build/es/src',
      }),
      base64({ include: "**/*.wasm" }),
    ],
  },

  {
    input: 'src/index.ts',
    output: [
      {
        file: `build/umd/${packageJson.name}.js`,
        // dir: 'build/umd',
        format: 'umd',
        name: packageJson.moduleName,
        banner,
        sourcemap: 'inline',
      },
      {
        file: `build/umd/${packageJson.name}.min.js`,
        // dir: 'build/umd',
        format: 'umd',
        name: packageJson.moduleName,
        banner,
        sourcemap: false,
        plugins: [
          terser(),
        ]
      },
    ],
    plugins: [
      nodeResolve({browser: true, extensions: ['.js', '.ts', '.wasm']}),
      postcss({
        extract: true,
      }),
      babel({
        extensions,
      }),
      typescript({
        declaration: true,
        rootDir: 'src',
        declarationDir: 'build/umd',
      }),
      base64({ include: "**/*.wasm" }),
    ],
  },
];
