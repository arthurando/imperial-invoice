import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  getConfig,
  setConfigDataDir,
  dataDir,
  extractionsDir,
  invoiceDir,
  correctionsPath,
  CONFIG_FILE,
} from './config';

describe('config', () => {
  let prevEnv: string | undefined;
  let prevHome: string | undefined;
  let tempHome: string;

  beforeEach(async () => {
    prevEnv = process.env.IMPERIAL_DATA_DIR;
    prevHome = process.env.HOME ?? process.env.USERPROFILE;
    tempHome = await fs.mkdtemp(path.join(os.tmpdir(), 'imperial-config-test-'));
    delete process.env.IMPERIAL_DATA_DIR;
    process.env.HOME = tempHome;
    process.env.USERPROFILE = tempHome;
  });

  afterAll(async () => {
    if (prevEnv === undefined) delete process.env.IMPERIAL_DATA_DIR;
    else process.env.IMPERIAL_DATA_DIR = prevEnv;
    if (prevHome === undefined) delete process.env.HOME;
    else {
      process.env.HOME = prevHome;
      process.env.USERPROFILE = prevHome;
    }
  });

  it('returns "default" source when no env and no config file', () => {
    expect(getConfig().source).toBe('default');
  });

  it('returns "env" source when IMPERIAL_DATA_DIR is set', () => {
    process.env.IMPERIAL_DATA_DIR = 'C:\\fake\\path';
    const c = getConfig();
    expect(c.source).toBe('env');
    expect(c.dataDir).toBe('C:\\fake\\path');
  });

  it('persists dataDir to the config file and reads it back', () => {
    setConfigDataDir('C:\\users\\me\\imperial-data');
    const c = getConfig();
    expect(c.source).toBe('config');
    expect(c.dataDir).toBe('C:\\users\\me\\imperial-data');
  });

  it('env overrides config file', () => {
    setConfigDataDir('C:\\users\\me\\imperial-data');
    process.env.IMPERIAL_DATA_DIR = 'D:\\override';
    expect(getConfig().source).toBe('env');
    expect(getConfig().dataDir).toBe('D:\\override');
  });

  it('derived paths join data dir with prototype/invoice subdirs', () => {
    process.env.IMPERIAL_DATA_DIR = path.join(tempHome, 'data');
    expect(extractionsDir()).toBe(path.join(tempHome, 'data', 'prototype', 'extractions'));
    expect(invoiceDir()).toBe(path.join(tempHome, 'data', 'invoice'));
    expect(correctionsPath()).toBe(path.join(tempHome, 'data', 'prototype', 'corrections.jsonl'));
    expect(dataDir()).toBe(path.join(tempHome, 'data'));
  });

  it('exposes CONFIG_FILE under the home directory', () => {
    expect(CONFIG_FILE.startsWith(tempHome)).toBe(true);
    expect(CONFIG_FILE.endsWith(path.join('.imperial-invoice', 'config.json'))).toBe(true);
  });
});
