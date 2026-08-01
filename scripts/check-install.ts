/**
 * Axis Mundi — the install gate.
 *
 * Every other check in this repo proves the source is good. This one proves
 * the source can be *installed*, which is a different claim and the one that
 * failed: `@eslint/js@^10` sat in devDependencies against `eslint@^9`, and
 * because pnpm resolves a conflicting peer with a warning while npm refuses
 * outright, the whole gate ran green on a tree production could not build.
 * Two thousand four hundred and ninety-two pages verified from a commit the
 * deploy never got past `npm install`.
 *
 * So this asserts what the deploy asserts, in the deploy's own terms:
 *
 *   1. `npm ci` resolves the lockfile against the manifest and exits zero, with
 *      no legacy-peer-deps and no --force. A dry run, because resolution is
 *      where the failure lives and a full install is not needed to reach it.
 *   2. Nothing committed to the repo quietly relaxes that. `legacy-peer-deps`
 *      in an .npmrc would make every check here pass and the deploy still fail,
 *      which is the exact shape of the bug this file exists to prevent.
 *   3. The pnpm lockfile still satisfies the manifest. pnpm is off the deploy
 *      path now, but it is still what a developer installs with, and a lockfile
 *      nobody verifies is how a manifest and its lock drift apart.
 *
 * npm is the deploy's manager and pnpm is the local one, so both have to work
 * and the cost of proving it is under two seconds.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const problems: string[] = [];
const fail = (what: string, detail: string): void => {
  problems.push(`${what}\n      ${detail}`);
};

/** Run a command, returning its exit code and combined output. */
const run = (cmd: string, args: string[]): { code: number; out: string } => {
  try {
    const out = execFileSync(cmd, args, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, npm_config_audit: 'false', npm_config_fund: 'false' },
    });
    return { code: 0, out };
  } catch (error) {
    const e = error as { status?: number; stdout?: string; stderr?: string; message?: string };
    return { code: e.status ?? 1, out: `${e.stdout ?? ''}${e.stderr ?? ''}${e.message ?? ''}` };
  }
};

/** The last few lines of a command's output, for a report worth reading. */
const tail = (out: string, lines = 6): string =>
  out
    .split('\n')
    .filter((l) => l.trim() !== '')
    .slice(-lines)
    .join('\n      ');

/* ── 1. npm ci ──────────────────────────────────────────────────────────── */

if (!existsSync(join(ROOT, 'package-lock.json'))) {
  fail('package-lock.json', 'missing — `npm ci` has nothing to install from');
} else {
  const npm = run('npm', ['ci', '--dry-run']);
  if (npm.code !== 0) {
    fail(
      'npm ci',
      `exited ${npm.code}. This is what the deploy sees:\n      ${tail(npm.out)}`,
    );
  }
}

/* ── 2. nothing relaxes peer resolution ─────────────────────────────────── */

/* Only files the repo carries. A developer's own ~/.npmrc is theirs; what
   matters is that nothing in the checkout tells a clean runner to ignore a
   conflict the way `--legacy-peer-deps` would. */
const RELAXERS = [
  /^\s*legacy-peer-deps\s*=\s*true/im,
  /^\s*force\s*=\s*true/im,
  /^\s*strict-peer-dependencies\s*=\s*false/im,
];
for (const file of ['.npmrc', '.yarnrc.yml']) {
  const path = join(ROOT, file);
  if (!existsSync(path)) continue;
  const text = readFileSync(path, 'utf8');
  for (const pattern of RELAXERS) {
    const hit = pattern.exec(text);
    if (hit !== null) {
      fail(file, `"${hit[0].trim()}" hides the conflicts this check exists to catch`);
    }
  }
}

/* ── 3. the pnpm lockfile still matches the manifest ────────────────────── */

let pnpmChecked = false;
if (existsSync(join(ROOT, 'pnpm-lock.yaml'))) {
  /* pnpm is a local convenience and is deliberately not on the deploy path, so
     it may simply be absent. That is not a failure — but it is not a pass
     either, and saying so out loud is the whole point: a check that quietly
     skips is a check that has stopped checking. CI installs pnpm precisely so
     this always runs somewhere. */
  if (run('pnpm', ['--version']).code !== 0) {
    console.log('  pnpm not installed — skipping the pnpm-lock.yaml check (CI runs it).');
  } else {
    /* Resolution only: this rewrites nothing and links nothing, and fails the
       same way `pnpm install --frozen-lockfile` would on a runner. */
    const pnpm = run('pnpm', ['install', '--frozen-lockfile', '--lockfile-only']);
    pnpmChecked = true;
    if (pnpm.code !== 0) {
      fail(
        'pnpm install --frozen-lockfile',
        `exited ${pnpm.code}, so pnpm-lock.yaml no longer matches package.json:\n      ${tail(pnpm.out)}`,
      );
    }
  }
}

/* ── report ─────────────────────────────────────────────────────────────── */

if (problems.length > 0) {
  console.error('\n  Install check FAILED\n');
  for (const p of problems) console.error(`  ${p}\n`);
  console.error(
    `  ${problems.length} problem${problems.length === 1 ? '' : 's'}. ` +
      'A tree that will not install is not a build, whatever the other checks say.\n',
  );
  process.exit(1);
}

console.log(
  `  Install check passed — npm ci resolves${pnpmChecked ? ', and both lockfiles match the manifest' : ' and matches the manifest'}.`,
);
