import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const args = parseArgs(process.argv.slice(2));
const inputPath = args.input;
const outputPath = args.output;
const reportPath = args.report;
const datasetMode = args["dataset-mode"];

if (!inputPath) {
  fail("Missing --input <path>");
}

if (!outputPath) {
  fail("Missing --output <path>");
}

const candidate = readJson(inputPath);
const approvedAt = new Date().toISOString();

validateCandidateBundle(candidate);
const validationReport = buildValidationReport(candidate, {
  inputPath,
  generatedAt: approvedAt
});
const approved = promoteCandidateBundle(candidate, approvedAt, datasetMetadataFromArgs(args, approvedAt));

mkdirSync(dirname(resolve(outputPath)), { recursive: true });
writeFileSync(resolve(outputPath), `${JSON.stringify(approved, null, 2)}\n`, "utf8");

if (reportPath) {
  mkdirSync(dirname(resolve(reportPath)), { recursive: true });
  writeFileSync(resolve(reportPath), `${JSON.stringify(validationReport, null, 2)}\n`, "utf8");
}

console.log(`Validated candidate bundle: ${inputPath}`);
if (reportPath) console.log(`Wrote validation report: ${reportPath}`);
console.log(`Wrote approved bundle: ${outputPath}`);

function parseArgs(argv) {
  const parsed = {};

  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];

    if (
      key === "--input" ||
      key === "--output" ||
      key === "--report" ||
      key === "--dataset-mode" ||
      key === "--disposable" ||
      key === "--dataset-warning"
    ) {
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
    fail(`Could not read JSON file ${path}: ${error.message}`);
  }
}

function validateCandidateBundle(bundle) {
  assertObject(bundle, "bundle");
  assertNonEmptyString(bundle.schemaVersion, "schemaVersion");
  assertIsoDate(bundle.generatedAt, "generatedAt");
  assertObject(bundle.source, "source");
  assertNonEmptyString(bundle.source.id, "source.id");
  assertNonEmptyString(bundle.source.name, "source.name");
  assert(typeof bundle.source.official === "boolean", "source.official must be boolean");

  const requiredArrays = [
    "legalItems",
    "provisions",
    "citations",
    "relationships",
    "rules",
    "concepts",
    "snapshots"
  ];

  for (const key of requiredArrays) {
    assert(Array.isArray(bundle[key]), `${key} must be an array`);
  }

  assert(bundle.legalItems.length > 0, "candidate bundle must include at least one legal item");
  assert(bundle.provisions.length > 0, "candidate bundle must include at least one provision");
  assert(bundle.citations.length > 0, "candidate bundle must include at least one citation");

  const legalItemIds = uniqueIds(bundle.legalItems, "legalItems");
  const provisionIds = uniqueIds(bundle.provisions, "provisions");
  uniqueIds(bundle.citations, "citations");

  for (const item of bundle.legalItems) {
    assertNonEmptyString(item.type, `legalItems.${item.id}.type`);
    assertNonEmptyString(item.title, `legalItems.${item.id}.title`);
    assertNonEmptyString(item.status, `legalItems.${item.id}.status`);
    assertObject(item.jurisdiction, `legalItems.${item.id}.jurisdiction`);
    assert(item.jurisdiction.country === "AR", `legalItems.${item.id}.jurisdiction.country must be AR`);
    assertNonEmptyString(item.jurisdiction.level, `legalItems.${item.id}.jurisdiction.level`);
    assertObject(item.source, `legalItems.${item.id}.source`);
  }

  for (const provision of bundle.provisions) {
    assert(legalItemIds.has(provision.legalItemId), `unknown provision legalItemId: ${provision.legalItemId}`);
    assertNonEmptyString(provision.type, `provisions.${provision.id}.type`);
    assertNonEmptyString(provision.label, `provisions.${provision.id}.label`);
    assert(Number.isInteger(provision.order), `provisions.${provision.id}.order must be integer`);
    assertNonEmptyString(provision.textOriginal, `provisions.${provision.id}.textOriginal`);
    assertNonEmptyString(provision.status, `provisions.${provision.id}.status`);
  }

  for (const citation of bundle.citations) {
    assert(legalItemIds.has(citation.sourceLegalItemId), `unknown citation sourceLegalItemId: ${citation.sourceLegalItemId}`);

    if (citation.provisionId) {
      assert(provisionIds.has(citation.provisionId), `unknown citation provisionId: ${citation.provisionId}`);
    }

    assertNonEmptyString(citation.originalText, `citations.${citation.id}.originalText`);
  }

  for (const rule of bundle.rules) {
    assert(Array.isArray(rule.citations) && rule.citations.length > 0, `rules.${rule.id}.citations is required`);
  }

  for (const relationship of bundle.relationships) {
    assert(
      Array.isArray(relationship.citations) && relationship.citations.length > 0,
      `relationships.${relationship.id}.citations is required`
    );
  }
}

function promoteCandidateBundle(candidate, approvedAt, dataset) {
  const bundle = {
    schemaVersion: candidate.schemaVersion,
    approvedAt,
    approvedBy: "legal-datavalidation-cli",
    legalItems: candidate.legalItems,
    provisions: candidate.provisions.map((provision) => ({
      ...provision,
      textCurrent: provision.textCurrent ?? provision.textOriginal
    })),
    citations: candidate.citations,
    relationships: candidate.relationships,
    rules: candidate.rules,
    concepts: candidate.concepts,
    snapshots: candidate.snapshots,
    readModels: {
      legalItemOverviews: candidate.legalItems.map((item) => buildOverview(candidate, item, approvedAt))
    }
  };

  if (dataset) {
    bundle.dataset = dataset;
  }

  return bundle;
}

function datasetMetadataFromArgs(parsedArgs, generatedAt) {
  if (!datasetMode) {
    return undefined;
  }

  return {
    mode: datasetMode,
    generatedAt,
    disposable: parsedArgs.disposable === "true",
    warning: parsedArgs["dataset-warning"]
  };
}

function buildValidationReport(candidate, { inputPath, generatedAt }) {
  const legalItemIds = new Set(candidate.legalItems.map((item) => item.id));
  const provisionById = new Map(candidate.provisions.map((provision) => [provision.id, provision]));
  const citationsByProvisionId = groupBy(
    candidate.citations.filter((citation) => citation.provisionId),
    (citation) => citation.provisionId
  );
  const provisionsWithoutCitation = candidate.provisions
    .filter((provision) => !citationsByProvisionId.has(provision.id))
    .map((provision) => ({
      id: provision.id,
      label: provision.label,
      legalItemId: provision.legalItemId
    }));
  const citationTextMismatches = candidate.citations
    .filter((citation) => citation.provisionId && provisionById.has(citation.provisionId))
    .filter((citation) => provisionById.get(citation.provisionId).textOriginal !== citation.originalText)
    .map((citation) => ({
      citationId: citation.id,
      provisionId: citation.provisionId
    }));
  const duplicateProvisionLabels = duplicateLabelsByLegalItem(candidate.provisions);
  const unknownStatusItems = candidate.legalItems
    .filter((item) => item.status === "DESCONOCIDO")
    .map((item) => ({ id: item.id, title: item.title }));
  const unknownStatusProvisions = candidate.provisions
    .filter((provision) => provision.status === "DESCONOCIDO")
    .map((provision) => ({ id: provision.id, label: provision.label }));
  const warnings = buildReportWarnings({
    provisionsWithoutCitation,
    citationTextMismatches,
    duplicateProvisionLabels,
    unknownStatusItems,
    unknownStatusProvisions
  });

  return {
    schemaVersion: "0.1.0",
    generatedAt,
    inputPath,
    source: candidate.source,
    summary: {
      legalItems: candidate.legalItems.length,
      provisions: candidate.provisions.length,
      citations: candidate.citations.length,
      relationships: candidate.relationships.length,
      rules: candidate.rules.length,
      concepts: candidate.concepts.length,
      snapshots: candidate.snapshots.length
    },
    structuralChecks: {
      legalItemReferencesValid: candidate.provisions.every((provision) => legalItemIds.has(provision.legalItemId)),
      citationCoverage: {
        provisionsWithCitation: candidate.provisions.length - provisionsWithoutCitation.length,
        provisionsWithoutCitation
      },
      citationTextMismatches,
      duplicateProvisionLabels
    },
    reviewSignals: {
      unknownStatusItems,
      unknownStatusProvisions,
      requiresHumanReview:
        warnings.length > 0 ||
        unknownStatusItems.length > 0 ||
        unknownStatusProvisions.length > 0 ||
        duplicateProvisionLabels.length > 0
    },
    warnings
  };
}

function buildReportWarnings({
  provisionsWithoutCitation,
  citationTextMismatches,
  duplicateProvisionLabels,
  unknownStatusItems,
  unknownStatusProvisions
}) {
  const warnings = [];

  if (provisionsWithoutCitation.length > 0) {
    warnings.push({
      code: "PROVISIONS_WITHOUT_CITATION",
      severity: "HIGH",
      message: "Hay disposiciones sin cita asociada; no deberian aprobarse como dato publicado."
    });
  }

  if (citationTextMismatches.length > 0) {
    warnings.push({
      code: "CITATION_TEXT_MISMATCH",
      severity: "HIGH",
      message: "Hay citas cuyo texto no coincide exactamente con la disposicion referenciada."
    });
  }

  if (duplicateProvisionLabels.length > 0) {
    warnings.push({
      code: "DUPLICATE_PROVISION_LABELS",
      severity: "MEDIUM",
      message: "Hay etiquetas de articulos repetidas dentro del mismo item legal; requieren revision manual."
    });
  }

  if (unknownStatusItems.length > 0 || unknownStatusProvisions.length > 0) {
    warnings.push({
      code: "UNKNOWN_LEGAL_STATUS",
      severity: "MEDIUM",
      message: "Hay items o disposiciones con estado legal DESCONOCIDO; requieren decision de revision."
    });
  }

  return warnings;
}

function buildOverview(candidate, item, approvedAt) {
  const itemProvisions = candidate.provisions.filter((provision) => provision.legalItemId === item.id);
  const pendingValidationCount =
    (item.status === "DESCONOCIDO" ? 1 : 0) +
    itemProvisions.filter((provision) => provision.status === "DESCONOCIDO").length;

  return {
    id: item.id,
    title: item.title,
    type: item.type,
    status: item.status,
    summaryPlainLanguage: item.summaryPlainLanguage ?? "Resumen pendiente de validacion editorial.",
    affectedSubjects: affectedSubjectsFor(candidate, item.id),
    currentEffects: currentEffectsFor(candidate, item.id),
    relationshipsSummary: relationshipsSummaryFor(candidate, item.id),
    freshness: {
      status: "UPDATED",
      lastValidatedAt: approvedAt,
      lastSourceCheckedAt: candidate.source.retrievedAt ?? candidate.generatedAt,
      pendingValidationCount
    }
  };
}

function affectedSubjectsFor(candidate, legalItemId) {
  const provisionIds = provisionsFor(candidate, legalItemId);
  const subjects = new Set();

  for (const rule of candidate.rules) {
    if (provisionIds.has(rule.sourceProvisionId) && rule.subject?.label) {
      subjects.add(rule.subject.label);
    }
  }

  return [...subjects].sort();
}

function currentEffectsFor(candidate, legalItemId) {
  const provisionIds = provisionsFor(candidate, legalItemId);
  const effects = {
    obligations: 0,
    prohibitions: 0,
    rights: 0,
    sanctions: 0
  };

  for (const rule of candidate.rules) {
    if (!provisionIds.has(rule.sourceProvisionId)) {
      continue;
    }

    if (rule.modality === "OBLIGATION") effects.obligations += 1;
    if (rule.modality === "PROHIBITION") effects.prohibitions += 1;
    if (rule.modality === "RIGHT") effects.rights += 1;
    if (rule.modality === "SANCTION") effects.sanctions += 1;
  }

  return effects;
}

function relationshipsSummaryFor(candidate, legalItemId) {
  const summary = {
    modifications: 0,
    regulations: 0,
    caseLaw: 0,
    doctrine: 0,
    administrativeCriteria: 0,
    pendingBills: 0
  };

  for (const relationship of candidate.relationships) {
    if (relationship.fromLegalItemId !== legalItemId && relationship.toLegalItemId !== legalItemId) {
      continue;
    }

    if (relationship.relationshipType === "MODIFIES") summary.modifications += 1;
    if (relationship.relationshipType === "REGULATES") summary.regulations += 1;
    if (relationship.relationshipType === "HAS_CASE_LAW") summary.caseLaw += 1;
    if (relationship.relationshipType === "HAS_DOCTRINAL_COMMENTARY") summary.doctrine += 1;
    if (relationship.relationshipType === "HAS_ADMINISTRATIVE_CRITERION") summary.administrativeCriteria += 1;
    if (
      relationship.relationshipType === "PROPOSES_TO_MODIFY" ||
      relationship.relationshipType === "PROPOSES_TO_REPEAL"
    ) {
      summary.pendingBills += 1;
    }
  }

  return summary;
}

function provisionsFor(candidate, legalItemId) {
  return new Set(
    candidate.provisions
      .filter((provision) => provision.legalItemId === legalItemId)
      .map((provision) => provision.id)
  );
}

function uniqueIds(items, label) {
  const ids = new Set();

  for (const item of items) {
    assertNonEmptyString(item.id, `${label}.id`);
    assert(!ids.has(item.id), `duplicate id in ${label}: ${item.id}`);
    ids.add(item.id);
  }

  return ids;
}

function duplicateLabelsByLegalItem(provisions) {
  const labelsByLegalItem = new Map();

  for (const provision of provisions) {
    if (!labelsByLegalItem.has(provision.legalItemId)) {
      labelsByLegalItem.set(provision.legalItemId, new Map());
    }

    const labelCounts = labelsByLegalItem.get(provision.legalItemId);
    labelCounts.set(provision.label, (labelCounts.get(provision.label) ?? 0) + 1);
  }

  const duplicates = [];

  for (const [legalItemId, labelCounts] of labelsByLegalItem.entries()) {
    for (const [label, count] of labelCounts.entries()) {
      if (count > 1) {
        duplicates.push({ legalItemId, label, count });
      }
    }
  }

  return duplicates;
}

function groupBy(items, keyFn) {
  const grouped = new Map();

  for (const item of items) {
    const key = keyFn(item);

    if (!grouped.has(key)) {
      grouped.set(key, []);
    }

    grouped.get(key).push(item);
  }

  return grouped;
}

function assertObject(value, label) {
  assert(value !== null && typeof value === "object" && !Array.isArray(value), `${label} must be an object`);
}

function assertNonEmptyString(value, label) {
  assert(typeof value === "string" && value.trim().length > 0, `${label} must be a non-empty string`);
}

function assertIsoDate(value, label) {
  assertNonEmptyString(value, label);
  assert(!Number.isNaN(Date.parse(value)), `${label} must be an ISO-like date`);
}

function assert(condition, message) {
  if (!condition) {
    fail(message);
  }
}

function fail(message) {
  console.error(`Validation failed: ${message}`);
  process.exit(1);
}
