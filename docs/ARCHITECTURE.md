# Arquitectura de datavalidation

## Objetivo

Validar y auditar datos candidatos antes de promoverlos a datos aprobados.

## Componentes esperados

```text
ingestion/
  candidate-reader
validators/
  schema-validator
  citation-validator
  temporal-consistency-validator
  relationship-validator
  confidence-validator
review/
  review-queue
  decision-log
promotion/
  approved-writer
  read-model-builder
freshness/
  freshness-calculator
```

## Contrato de entrada

La entrada debe venir desde `legal-datacollection` como candidate data compatible con `legal-contracts`.

## Contrato de salida

La salida debe ser approved data y read models consumibles por `legal-backend`.

## Regla de separacion

`legal-datavalidation` no reemplaza al backend publico. Su rol es interno: decidir que datos pueden pasar a la capa aprobada.

