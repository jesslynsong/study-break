import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

for (const exitCode of [0, 7]) test(`publishing restores the repository placeholder and redacts its code after exit ${exitCode}`, async t => {
  const tempBase = fileURLToPath(new URL('../.cache/', import.meta.url));
  await fs.mkdir(tempBase,{recursive:true});
  const root = await fs.mkdtemp(path.join(tempBase, 'study-break-publish-test-'));
  t.after(async () => {
    const resolved = path.resolve(root);
    if (!resolved.startsWith(path.resolve(tempBase) + path.sep) || !path.basename(resolved).startsWith('study-break-publish-test-')) throw new Error('Unexpected test cleanup path');
    await fs.rm(resolved, {recursive:true, force:true});
  });
  await fs.mkdir(path.join(root,'scripts'),{recursive:true});
  await fs.mkdir(path.join(root,'server'),{recursive:true});
  await fs.mkdir(path.join(root,'node_modules','netlify-cli','bin'),{recursive:true});
  await fs.writeFile(path.join(root,'package.json'),'{"type":"module"}');
  const placeholder = '// Unconfigured repository placeholder.\nexport const organiserVerifier = null;\n';
  await fs.writeFile(path.join(root,'server','access-verifier.mjs'),placeholder);
  await fs.copyFile(new URL('../scripts/publish.mjs',import.meta.url),path.join(root,'scripts','publish.mjs'));
  await fs.writeFile(path.join(root,'node_modules','netlify-cli','bin','run.js'),`import fs from 'node:fs';\nimport {createHash} from 'node:crypto';\nconst verifier=fs.readFileSync('server/access-verifier.mjs','utf8');\nif(!verifier.includes(createHash('sha256').update(process.env.ORGANISER_KEY).digest('hex')))process.exit(90);\nconsole.log(process.env.ORGANISER_KEY);\nconsole.error(process.env.ORGANISER_KEY);\nprocess.exit(Number(process.env.PUBLISH_TEST_EXIT));\n`);
  const secret = 'development-publish-fixture-only-not-a-live-code-2026';
  const result = spawnSync(process.execPath,['scripts/publish.mjs'],{cwd:root,encoding:'utf8',env:{...process.env,ORGANISER_KEY:secret,PUBLISH_TEST_EXIT:String(exitCode)}});
  assert.equal(result.status,exitCode,result.stderr + result.stdout);
  assert.equal(await fs.readFile(path.join(root,'server','access-verifier.mjs'),'utf8'),placeholder);
  assert.equal((result.stdout+result.stderr).includes(secret),false);
  assert.match(result.stdout,/private organiser code redacted/);
});
