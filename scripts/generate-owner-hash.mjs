#!/usr/bin/env node
import { createHash } from 'node:crypto';

const code = process.argv[2];
if (!code) {
  console.error('Usage: node scripts/generate-owner-hash.mjs "your-owner-code"');
  process.exit(1);
}

console.log(createHash('sha256').update(code).digest('hex'));
