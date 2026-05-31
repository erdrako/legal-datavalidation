import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const args = new Set(process.argv.slice(2));
const repoRoot = resolve(".");
const workspaceRoot = resolve("..");
const targets = [
  "data/dev",
  "data/d1",
  "data/reports/dev"
].map((path) => resolve(repoRoot, path));

if (args.has("--include-review-decisions")) {
  targets.push(resolve(repoRoot, "data/review"));
}

if (args.has("--include-approved")) {
  targets.push(resolve(repoRoot, "data/approved"));
}

if (args.has("--include-datacollection")) {
  targets.push(
    resolve(workspaceRoot, "legal-datacollection/data/raw"),
    resolve(workspaceRoot, "legal-datacollection/data/parsed"),
    resolve(workspaceRoot, "legal-datacollection/data/candidate")
  );
}

for (const target of targets) {
  assertInsideWorkspace(target);

  if (!existsSync(target)) {
    continue;
  }

  rmSync(target, { recursive: true, force: true });
  console.log(`Removed ${target}`);
}

console.log("Development data cleanup completed.");

function assertInsideWorkspace(target) {
  if (!target.startsWith(workspaceRoot)) {
    console.error(`Refusing to remove path outside workspace: ${target}`);
    process.exit(1);
  }
}

