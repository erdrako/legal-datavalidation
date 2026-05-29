import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { basename, dirname, join, resolve } from "node:path";

const args = parseArgs(process.argv.slice(2));

for (const requiredArg of ["candidate-dir", "output", "report-dir"]) {
  if (!args[requiredArg]) {
    fail(`Missing --${requiredArg} <value>`);
  }
}

const candidateDir = resolve(args["candidate-dir"]);
const candidatePrefix = args["candidate-glob"] ?? "";
const candidateFiles = readdirSync(candidateDir)
  .filter((file) => file.endsWith(".candidate.json"))
  .filter((file) => file.startsWith(candidatePrefix))
  .sort();

if (candidateFiles.length === 0) {
  fail(`No candidate files found in ${candidateDir}`);
}

const approvedAt = new Date().toISOString();
const approvedBundles = [];
const validationReports = [];

mkdirSync(resolve(args["report-dir"]), { recursive: true });

for (const file of candidateFiles) {
  const inputPath = join(candidateDir, file);
  const stem = basename(file, ".candidate.json");
  const individualOutput = join(resolve(args["report-dir"]), `${stem}.approved.generated.json`);
  const reportOutput = join(resolve(args["report-dir"]), `${stem}.validation-report.generated.json`);

  const result = spawnSync(process.execPath, [
    "scripts/validate-candidate.mjs",
    "--input",
    inputPath,
    "--output",
    individualOutput,
    "--report",
    reportOutput,
    "--dataset-mode",
    "DEV_STRUCTURAL",
    "--disposable",
    "true",
    "--dataset-warning",
    "Dataset de desarrollo descartable; no usar como aprobacion legal."
  ], {
    encoding: "utf8",
    stdio: "pipe"
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  if (result.status !== 0) {
    fail(`Validation failed for ${file}`);
  }

  approvedBundles.push(readJson(individualOutput));
  validationReports.push(readJson(reportOutput));
}

const merged = mergeApprovedBundles(approvedBundles, validationReports, approvedAt);

mkdirSync(dirname(resolve(args.output)), { recursive: true });
writeFileSync(resolve(args.output), `${JSON.stringify(merged, null, 2)}\n`, "utf8");

console.log(`Merged dev structural dataset: ${args.output}`);
console.log(`Candidate files merged: ${candidateFiles.length}`);

function mergeApprovedBundles(bundles, reports, generatedAt) {
  return {
    schemaVersion: "0.1.0",
    approvedAt: generatedAt,
    approvedBy: "legal-datavalidation-dev-structural-flow",
    dataset: {
      mode: "DEV_STRUCTURAL",
      generatedAt,
      disposable: true,
      sourceCandidateCount: bundles.length,
      warning: "Dataset de desarrollo descartable. Validado estructuralmente, no revisado legalmente."
    },
    legalItems: bundles.flatMap((bundle) => bundle.legalItems),
    provisions: bundles.flatMap((bundle) => bundle.provisions),
    citations: bundles.flatMap((bundle) => bundle.citations),
    relationships: bundles.flatMap((bundle) => bundle.relationships),
    rules: bundles.flatMap((bundle) => bundle.rules),
    concepts: bundles.flatMap((bundle) => bundle.concepts),
    snapshots: bundles.flatMap((bundle) => bundle.snapshots),
    readModels: {
      legalItemOverviews: bundles.flatMap((bundle) => bundle.readModels.legalItemOverviews)
    },
    validationSummary: {
      reports: reports.map((report) => ({
        inputPath: report.inputPath,
        summary: report.summary,
        requiresHumanReview: report.reviewSignals.requiresHumanReview,
        warnings: report.warnings
      }))
    }
  };
}

function parseArgs(argv) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];

    if (key.startsWith("--")) {
      if (!value || value.startsWith("--")) {
        fail(`Missing value for ${key}`);
      }

      parsed[key.slice(2)] = value;
      index += 1;
    }
  }

  return parsed;
}

function readJson(path) {
  return JSON.parse(readFileSync(resolve(path), "utf8"));
}

function fail(message) {
  console.error(`Dev structural dataset failed: ${message}`);
  process.exit(1);
}

