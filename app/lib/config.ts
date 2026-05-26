import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

interface Config {
  dataDir: string | null;
}

export const CONFIG_FILE = path.join(
  process.env.HOME ?? process.env.USERPROFILE ?? os.homedir(),
  '.imperial-invoice',
  'config.json',
);

function readConfig(): Config {
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, 'utf8')) as Config;
  } catch {
    return { dataDir: null };
  }
}

/**
 * Active data dir.
 *
 * Resolver order:
 *   1. `IMPERIAL_DATA_DIR` env var (CI / Electron / explicit override)
 *   2. The path saved via the in-app /settings picker
 *   3. Repo-relative dev fallback (one directory up from `app/`)
 */
export function dataDir(): string {
  const env = process.env.IMPERIAL_DATA_DIR;
  if (env && env.length > 0) return env;
  const cfg = readConfig();
  if (cfg.dataDir && cfg.dataDir.length > 0) return cfg.dataDir;
  return path.resolve(process.cwd(), '..');
}

export function getConfig(): {
  dataDir: string;
  source: 'env' | 'config' | 'default';
  configFile: string;
} {
  const env = process.env.IMPERIAL_DATA_DIR;
  if (env && env.length > 0) {
    return { dataDir: env, source: 'env', configFile: CONFIG_FILE };
  }
  const cfg = readConfig();
  if (cfg.dataDir && cfg.dataDir.length > 0) {
    return { dataDir: cfg.dataDir, source: 'config', configFile: CONFIG_FILE };
  }
  return {
    dataDir: path.resolve(process.cwd(), '..'),
    source: 'default',
    configFile: CONFIG_FILE,
  };
}

export function setConfigDataDir(p: string): void {
  mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify({ dataDir: p }, null, 2), 'utf8');
}

export function clearConfig(): void {
  if (existsSync(CONFIG_FILE)) {
    writeFileSync(CONFIG_FILE, JSON.stringify({ dataDir: null }, null, 2), 'utf8');
  }
}

export function extractionsDir(): string {
  return path.join(dataDir(), 'prototype', 'extractions');
}

export function invoiceDir(): string {
  return path.join(dataDir(), 'invoice');
}

export function correctionsPath(): string {
  return path.join(dataDir(), 'prototype', 'corrections.jsonl');
}
