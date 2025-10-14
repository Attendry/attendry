'use strict';

const path = require('path');

require('ts-node').register({
  transpileOnly: true,
  compilerOptions: {
    module: 'commonjs',
    moduleResolution: 'node',
    allowImportingTsExtensions: true,
    baseUrl: path.resolve(__dirname, '..'),
    paths: {
      '@/*': ['src/*']
    }
  }
});

require(path.resolve(__dirname, '../src/search/eval/run-evals.ts'));
