import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../..', import.meta.url));
const read = (path) => readFileSync(`${root}/${path}`, 'utf8');
const web = (path) => read(`apps/web/${path}`);
test('shadcn new-york component configuration and required Radix Slot dependency', () => {
  const cfg = JSON.parse(web('components.json'));
  const pkg = JSON.parse(web('package.json'));
  assert.equal(cfg.style, 'new-york');
  assert.equal(cfg.tsx, true);
  assert.ok(pkg.dependencies['@radix-ui/react-slot']);
  assert.ok(pkg.dependencies['class-variance-authority']);
});
test('TradeNest brand colors and compatibility variants preserved', () => {
  const globals = web('app/globals.css');
  for (const color of ['--tradenest-navy: #0b2a4a','--tradenest-teal: #0fa3a3','--tradenest-gold: #d6a84b']) {
    assert.ok(globals.includes(color));
  }
  const button = web('components/ui/button.tsx');
  for (const name of ['primary:', 'secondary:', 'outline:', 'ghost:', 'danger:', 'ai:', 'sm:', 'md:', 'lg:', 'asChild']) assert.ok(button.includes(name));
  const badge = web('components/ui/badge.tsx');
  for (const tone of ['neutral:', 'success:', 'warning:', 'danger:', 'ai:', 'escrow:']) assert.ok(badge.includes(tone));
});
test('shadcn component conventions and class merging present', () => {
  assert.ok(web('components/ui/button.tsx').includes('const Comp = asChild ? Slot'));
  assert.ok(web('components/ui/badge.tsx').includes('badgeVariants = cva('));
  for (const c of ['button','badge','card','input','textarea']) assert.ok(web(`components/ui/${c}.tsx`).includes('React.forwardRef'));
  assert.ok(web('lib/cn.ts').includes('twMerge(clsx(inputs))'));
});
