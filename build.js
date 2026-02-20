// build.js — generates dist/ files
import * as esbuild from 'esbuild';
import { copyFileSync, mkdirSync } from 'fs';

mkdirSync('./dist', { recursive: true });

const shared = {
  entryPoints: ['src/index.js'],
  bundle: true,
  minify: true,
  target: ['es2020', 'chrome80', 'firefox80', 'safari14'],
  sourcemap: true,
  legalComments: 'none',
};

await esbuild.build({ ...shared, format: 'esm',  outfile: 'dist/github-crud.es.js' });
await esbuild.build({ ...shared, format: 'iife', globalName: 'GithubCRUDLib', outfile: 'dist/github-crud.umd.cjs',
  footer: { js: 'if(typeof window!=="undefined"){window.GithubCRUD=GithubCRUDLib.GithubCRUD;window.GithubCRUDLib=GithubCRUDLib;}' }
});

copyFileSync('src/github-crud.css', 'dist/github-crud.css');
console.log('✅ dist/ ready');
