#!/usr/bin/env node
import {existsSync, mkdirSync, readFileSync, writeFileSync} from "node:fs";
import {dirname, resolve} from "node:path";
import {spawnSync} from "node:child_process";

const SUPABASE_WORKDIR = "infra";
const TYPES_OUTPUT = "packages/types/src/supabase.ts";
const command = process.argv[2];
const environment = process.argv[3] ?? "";

loadEnvFiles([".env", ".env.local", ".env.supabase"]);

const commands = new Set(["login", "link", "push", "dry", "types"]);
if (!commands.has(command)) {
  console.error("Usage: pnpm sb:<login|link|push|push:dry|types> [environment]");
  process.exit(1);
}

if (command === "login") {
  runSupabase(["login"]);
} else if (command === "link") {
  const projectRef = projectRefFor(environment);
  runSupabase(["link", "--project-ref", projectRef, "--workdir", SUPABASE_WORKDIR]);
} else if (command === "push") {
  runSupabase(["db", "push", "--workdir", SUPABASE_WORKDIR]);
} else if (command === "dry") {
  runSupabase(["db", "push", "--dry-run", "--workdir", SUPABASE_WORKDIR]);
} else if (command === "types") {
  const output = runSupabase(
    ["gen", "types", "typescript", "--linked", "--schema", "public", "--workdir", SUPABASE_WORKDIR],
    {capture: true},
  );
  mkdirSync(dirname(TYPES_OUTPUT), {recursive: true});
  writeFileSync(TYPES_OUTPUT, output);
  console.log(`Wrote ${TYPES_OUTPUT}`);
}

function projectRefFor(target) {
  const suffix = target.trim().toUpperCase();
  const names = suffix
    ? [`SUPABASE_PROJECT_REF_${suffix}`, `${suffix}_SUPABASE_PROJECT_REF`, "SUPABASE_PROJECT_REF"]
    : ["SUPABASE_PROJECT_REF"];
  for (const name of names) {
    if (process.env[name]) {
      return process.env[name];
    }
  }
  console.error(`Missing ${names.join(" or ")} for Supabase project linking.`);
  process.exit(1);
}

function runSupabase(args, options = {}) {
  const result = spawnSync("pnpm", ["exec", "supabase", ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: options.capture ? ["inherit", "pipe", "inherit"] : "inherit",
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
  return result.stdout ?? "";
}

function loadEnvFiles(files) {
  for (const file of files) {
    const path = resolve(process.cwd(), file);
    if (!existsSync(path)) {
      continue;
    }
    const contents = readFileSync(path, "utf8");
    for (const line of contents.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }
      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match) {
        continue;
      }
      const [, key, rawValue] = match;
      if (process.env[key] !== undefined) {
        continue;
      }
      process.env[key] = unquote(rawValue.trim());
    }
  }
}

function unquote(value) {
  if (value.length >= 2 && value[0] === value[value.length - 1] && ["'", "\""].includes(value[0])) {
    return value.slice(1, -1);
  }
  return value;
}
