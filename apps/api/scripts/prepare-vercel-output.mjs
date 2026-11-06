/**
 * Assemble a Vercel Build Output (v3) around the esbuild bundle.
 *
 * Why this exists: Vercel discovers `api/**` functions at upload time, before the
 * build runs — so a bundle produced *during* the build is invisible to it, and the
 * deployment 404s every route. The Build Output API is the supported way to hand the
 * platform a finished function: write .vercel/output/functions/<name>.func with a
 * .vc-config.json, plus a routes manifest, and Vercel serves exactly that.
 *
 * The alternative — pointing @vercel/node at the TypeScript entry — fails at cold
 * start with ERR_MODULE_NOT_FOUND, because it compiles files one at a time and Node's
 * ESM resolver rejects this project's extensionless imports.
 */
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';

const FUNCTION = 'api.func';
const root = '.vercel/output';
const dir = `${root}/functions/${FUNCTION}`;

rmSync(root, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });

cpSync('api/index.js', `${dir}/index.js`);

writeFileSync(
  `${dir}/.vc-config.json`,
  JSON.stringify(
    {
      runtime: 'nodejs22.x',
      handler: 'index.js',
      launcherType: 'Nodejs',
      // The Express app owns routing; Vercel must not wrap the request.
      shouldAddHelpers: false,
      maxDuration: 30,
      memory: 1024,
    },
    null,
    2,
  ),
);

writeFileSync(
  `${root}/config.json`,
  JSON.stringify(
    {
      version: 3,
      routes: [{ src: '/(.*)', dest: '/api' }],
    },
    null,
    2,
  ),
);

console.log(`vercel output ready: ${dir}/index.js`);
