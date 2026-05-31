import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const args = parseArgs(process.argv.slice(2));

if (args.approved.length === 0) {
  fail("Missing --approved <path>");
}

if (args.decision.length === 0) {
  fail("Missing --decision <path>");
}

if (!args.output) {
  fail("Missing --output <path>");
}

const mode = args.mode ?? "HUMAN_REVIEWED";
const allowedModes = new Set(["HUMAN_REVIEWED", "PRODUCTION_APPROVED"]);
const allowReviewWarnings = args["allow-review-warnings"] === "true";
const allowHighWarnings = args["allow-high-warnings"] === "true";

if (!allowedModes.has(mode)) {
  fail(`Invalid --mode ${mode}`);
}

const approvedBundles = args.approved.map((path) => readJson(path));
const decisions = args.decision.map((path) => ({
  path,
  record: readJson(path)
}));
const generatedAt = new Date().toISOString();
const reviewers = [...new Set(decisions.map(({ record }) => record.reviewer).filter(Boolean))].sort();
const approvedBy = (args["approved-by"] ?? reviewers.join(", ")) || "lexmapa-review-flow";
const allowedDecisionByLegalItem = decisionsAllowedForPromotion(decisions);
const promotionGate = promotionGateFor(decisions, {
  allowReviewWarnings,
  allowHighWarnings
});

assertAllLegalItemsCovered(approvedBundles, allowedDecisionByLegalItem);

const promoted = mergeBundles({
  approvedBundles,
  decisions,
  generatedAt,
  mode,
  approvedBy,
  promotionGate
});

mkdirSync(dirname(resolve(args.output)), { recursive: true });
writeFileSync(resolve(args.output), `${JSON.stringify(promoted, null, 2)}\n`, "utf8");

console.log(`Promoted reviewed dataset: ${args.output}`);
console.log(`Dataset mode: ${mode}`);
console.log(`Approved bundles: ${approvedBundles.length}`);
console.log(`Review decisions: ${decisions.length}`);

function decisionsAllowedForPromotion(decisionsWithPaths) {
  const allowed = new Map();

  for (const { path, record } of decisionsWithPaths) {
    if (!record.allowedPromotion) {
      fail(`Decision does not allow promotion: ${path}`);
    }

    if (record.decision !== "APPROVE" && record.decision !== "APPROVE_PARTIAL") {
      fail(`Decision is not promotable: ${path}`);
    }

    assertDecisionWarningsCompatible(path, record);

    for (const legalItemId of record.scope?.legalItemIds ?? []) {
      if (!allowed.has(legalItemId)) {
        allowed.set(legalItemId, []);
      }

      allowed.get(legalItemId).push(path);
    }
  }

  return allowed;
}

function assertDecisionWarningsCompatible(path, record) {
  const warnings = record.validationSignals?.warnings ?? [];
  const highWarnings = warnings.filter((warning) => warning.severity === "HIGH");
  const requiresHumanReview = record.validationSignals?.requiresHumanReview === true;

  if (highWarnings.length > 0 && !allowHighWarnings) {
    fail(`Decision ${path} has HIGH validation warnings. Use --allow-high-warnings true only with documented legal review.`);
  }

  if (record.decision === "APPROVE" && (warnings.length > 0 || requiresHumanReview) && !allowReviewWarnings) {
    fail(
      [
        `Decision ${path} is APPROVE but still has validation warnings or review signals.`,
        "Use APPROVE_PARTIAL, clear the warnings, or pass --allow-review-warnings true with documented justification."
      ].join(" ")
    );
  }
}

function assertAllLegalItemsCovered(bundles, allowedDecisionByLegalItem) {
  const missing = [];

  for (const bundle of bundles) {
    for (const item of bundle.legalItems ?? []) {
      if (!allowedDecisionByLegalItem.has(item.id)) {
        missing.push(item.id);
      }
    }
  }

  if (missing.length > 0) {
    fail(`Missing promotable review decisions for legal items: ${[...new Set(missing)].sort().join(", ")}`);
  }
}

function promotionGateFor(decisionsWithPaths, policy) {
  const warnings = decisionsWithPaths.flatMap(({ record }) => record.validationSignals?.warnings ?? []);
  const warningCounts = warnings.reduce((counts, warning) => {
    const severity = warning.severity ?? "UNKNOWN";
    counts[severity] = (counts[severity] ?? 0) + 1;
    return counts;
  }, {});
  const reviewScope = decisionsWithPaths.some(({ record }) => record.decision === "APPROVE_PARTIAL")
    ? "PARTIAL"
    : "FULL";

  return {
    reviewScope,
    allowReviewWarnings: policy.allowReviewWarnings,
    allowHighWarnings: policy.allowHighWarnings,
    warningCounts
  };
}

function mergeBundles({ approvedBundles, decisions, generatedAt, mode, approvedBy, promotionGate }) {
  return {
    schemaVersion: "0.1.0",
    approvedAt: generatedAt,
    approvedBy,
    dataset: {
      mode,
      generatedAt,
      disposable: false,
      sourceBundleCount: approvedBundles.length,
      reviewDecisionCount: decisions.length,
      reviewScope: promotionGate.reviewScope,
      promotionGate,
      reviewDecisions: decisions.map(({ path, record }) => ({
        path,
        decidedAt: record.decidedAt,
        reviewer: record.reviewer,
        decision: record.decision,
        legalItemIds: record.scope?.legalItemIds ?? []
      }))
    },
    legalItems: approvedBundles.flatMap((bundle) => bundle.legalItems ?? []),
    provisions: approvedBundles.flatMap((bundle) => bundle.provisions ?? []),
    citations: approvedBundles.flatMap((bundle) => bundle.citations ?? []),
    relationships: approvedBundles.flatMap((bundle) => bundle.relationships ?? []),
    rules: approvedBundles.flatMap((bundle) => bundle.rules ?? []),
    concepts: approvedBundles.flatMap((bundle) => bundle.concepts ?? []),
    snapshots: approvedBundles.flatMap((bundle) => bundle.snapshots ?? []),
    readModels: {
      legalItemOverviews: approvedBundles.flatMap((bundle) => bundle.readModels?.legalItemOverviews ?? [])
    },
    validationSummary: {
      promotedFrom: approvedBundles.map((bundle) => ({
        approvedAt: bundle.approvedAt,
        approvedBy: bundle.approvedBy,
        mode: bundle.dataset?.mode ?? "UNSPECIFIED",
        legalItemIds: (bundle.legalItems ?? []).map((item) => item.id)
      }))
    }
  };
}

function parseArgs(argv) {
  const parsed = {
    approved: [],
    decision: []
  };

  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];

    if (!key.startsWith("--")) {
      continue;
    }

    if (!value || value.startsWith("--")) {
      fail(`Missing value for ${key}`);
    }

    const name = key.slice(2);

    if (name === "approved" || name === "decision") {
      parsed[name].push(value);
    } else {
      parsed[name] = value;
    }

    index += 1;
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
  console.error(`Reviewed dataset promotion failed: ${message}`);
  process.exit(1);
}
