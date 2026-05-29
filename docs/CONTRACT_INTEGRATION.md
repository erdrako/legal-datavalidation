# Integracion con legal-contracts

## Rol de este repositorio

`legal-datavalidation` consume candidate bundles y produce approved bundles.

Contratos de referencia:

```text
legal-contracts/schemas/candidate-bundle.schema.json
legal-contracts/schemas/approved-bundle.schema.json
legal-contracts/fixtures/candidate-bundle.example.json
legal-contracts/fixtures/approved-bundle.example.json
```

## Entrada

La entrada normal es un candidate bundle generado por `legal-datacollection`.

Debe validarse:

- Estructura.
- Existencia de ids referenciados.
- Citas.
- Consistencia temporal.
- Estado de revision.
- Nivel de confianza.

## Salida

La salida aprobada es un approved bundle.

Debe incluir:

- Datos aprobados.
- Metadata de aprobacion.
- Read models iniciales.
- Freshness.

## Decision auditada

Toda promocion de candidate a approved debe poder responder:

- Que dato se aprobo.
- Quien o que proceso lo aprobo.
- Cuando se aprobo.
- Que citas fueron revisadas.
- Que datos quedaron rechazados o pendientes.

## Regla de bloqueo

Un dato interpretado sin cita no puede pasar a approved.

