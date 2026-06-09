import { readFileSync, existsSync } from 'node:fs';
const envPath = existsSync('.env.test') ? '.env.test' : '.env.test.example';
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) {
    let val = m[2].trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    process.env[m[1]] = val;
  }
}
process.env.NODE_ENV = 'test';
const { buildServer } = await import('./src/server.ts');
const app = await buildServer();
console.log(app.printRoutes({ commonPrefix: false }));
await app.close();
