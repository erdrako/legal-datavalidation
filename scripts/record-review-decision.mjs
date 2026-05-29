import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const args = parseArgs(process.argv.slice(2));

for (const requiredArg of ["candidate", "validation-report", "decision", "reviewer", "output"]) {
  if (!args[requiredArg]) {
    fail(`Missing --${requiredArg} <value>`);
  }
}

const allowedDecisions = new Set(["APPROVE_PARTIAL", "APPROVE", "REJECT", "REQUEST_REVIEW"]);

if (!allowedDecisions.has(args.decision)) {
  fail(`Invalid decision ${args.decision}`);
}

const candidate = readJson(args.candidate);
const validationReport = readJson(args["validation-report"]);
const decidedAt = new Date().toISOString();

const decisionRecord = {
  schemaVersion: "0.1.0",
  decidedAt,
  reviewer: args.reviewer,
  decision: args.decision,
  notes: args.notes,
  inputs: {
    candidate: args.candidate,
    parsingReport: args["parsing-report"],
    validationReport: args["validation-report"]
  },
  scope: {
    legalItemIds: candidate.legalItems.map((item) => item.id),
    provisionCount: candidate.provisions.length,
    citationCount: candidate.citations.length
  },
  validationSignals: {
    requiresHumanReview: validationReport.reviewSignals?.requiresHumanReview ?? true,
    warnings: validationReport.warnings ?? []
  },
  allowedPromotion:
    args.decision === "APPROVE" ||
    args.decision === "APPROVE_PARTIAL"
};

mkdirSync(dirname(resolve(args.output)), { recursive: true });
writeFileSync(resolve(args.output), `${JSON.stringify(decisionRecord, null, 2)}\n`, "utf8");

console.log(`Wrote review decision: ${args.output}`);

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
  try {
    return JSON.parse(readFileSync(resolve(path), "utf8"));
  } catch (error) {
    fail(`Could not read JSON ${path}: ${error.message}`);
  }
}

function fail(message) {
  console.error(`Review decision failed: ${message}`);
  process.exit(1);
}

