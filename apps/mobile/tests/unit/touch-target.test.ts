import { readFileSync } from 'node:fs';
import { globSync } from 'glob';

const files = globSync('src/components/**/*.tsx', { cwd: process.cwd() }).filter((f) => !f.endsWith('.test.tsx'));
const INTERACTIVE = /<(Pressable|TouchableOpacity|TouchableHighlight|Button)\b/;
const HAS_MIN = /minHeight:\s*([0-9]+)/g;

describe('interactive primitives have minHeight >= 44', () => {
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    if (!INTERACTIVE.test(src)) continue;
    it(f, () => {
      let found = false;
      let fail = false;
      for (const m of src.matchAll(HAS_MIN)) {
        found = true;
        if (Number(m[1]) < 44) { fail = true; break; }
      }
      expect(found).toBe(true);
      expect(fail).toBe(false);
    });
  }
});
