#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const envPath = path.join(root, ".env.example");

if (!fs.existsSync(envPath)) {
  console.error(`Missing ${envPath}`);
  process.exit(2);
}

const contents = fs.readFileSync(envPath, "utf8");
const keys = [];
const counts = new Map();

for (const rawLine of contents.split(/\r?\n/)) {
  const line = rawLine.trim();
  if (!line || line.startsWith("#")) continue;
  const idx = line.indexOf("=");
  if (idx <= 0) continue;
  const key = line.slice(0, idx).trim();
  if (!key) continue;
  keys.push(key);
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

const duplicates = [...counts.entries()].filter(([, count]) => count > 1);

const unused = [];
for (const key of keys) {
  const res = spawnSync(
    "rg",
    ["-n", "--glob", "!.env.example", key, root],
    { stdio: "ignore" },
  );
  if (res.status !== 0) {
    unused.push(key);
  }
}

const uniqueUnused = [...new Set(unused)];

if (duplicates.length === 0 && uniqueUnused.length === 0) {
  console.log("env validation ok: no unused or duplicate variables");
  process.exit(0);
}

if (uniqueUnused.length > 0) {
  console.log("Unused vars (not referenced outside .env.example):");
  for (const key of uniqueUnused) console.log(`- ${key}`);
}

if (duplicates.length > 0) {
  console.log("Duplicate vars in .env.example:");
  for (const [key, count] of duplicates) {
    console.log(`- ${key} (${count} entries)`);
  }
}

process.exit(1);
