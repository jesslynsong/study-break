import fs from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root = fileURLToPath(new URL('../', import.meta.url));
let secret = process.env.ORGANISER_KEY?.trim();
if (!secret) {
  try { secret = (await fs.readFile(new URL('../.cache/organiser-code.private.txt', import.meta.url), 'utf8')).trim(); } catch {}
}
if (!secret || secret.length < 24) throw new Error('Set ORGANISER_KEY privately before publishing. Never put it in source files or public assets.');
// Only a one-way verifier goes into the private server bundle. The 256-bit
// random plaintext code stays outside source and never enters the browser bundle.
const sha256 = createHash('sha256').update(secret).digest('hex');
const verifierPath = new URL('../server/access-verifier.mjs', import.meta.url);
const previousVerifier = await fs.readFile(verifierPath);
try {
  await fs.writeFile(new URL('../server/access-verifier.mjs', import.meta.url), `// Generated server-only verifier. Never place the plaintext code here.\nexport const organiserVerifier = { sha256: '${sha256}' };\n`);
  const result = spawnSync(process.execPath, [
    'node_modules/netlify-cli/bin/run.js', 'deploy', '--prod', '--build', '--context', 'production',
    '--json'
  ], { cwd: root, encoding: 'utf8', maxBuffer: 5000000, env: { ...process.env, NO_UPDATE_NOTIFIER: '1', NETLIFY_TELEMETRY_DISABLED: '1' } });
  for (const value of [result.stdout, result.stderr]) if (value) process.stdout.write(value.split(secret).join('[private organiser code redacted]'));
  process.exitCode = result.status || (result.error ? 1 : 0);
  
} finally {
  // Keep the checked-in placeholder intact after successful or failed publication.
  await fs.writeFile(verifierPath, previousVerifier);
}
