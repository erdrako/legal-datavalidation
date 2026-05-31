# Decisiones de revision

## Objetivo

Toda decision de validacion debe ser auditable.

## Campos minimos de una decision

- Id del job.
- Id del candidato revisado.
- Decision: aprobar, rechazar o pedir revision.
- Motivo.
- Usuario o proceso que decide.
- Fecha.
- Citas revisadas.
- Cambios aplicados, si los hubiera.

## CLI inicial

Para registrar una decision de revision:

```bash
node scripts/record-review-decision.mjs \
  --candidate path/to/candidate.json \
  --parsing-report path/to/parsing-report.json \
  --validation-report path/to/validation-report.json \
  --decision REQUEST_REVIEW \
  --reviewer reviewer-id \
  --notes "Motivo de la decision" \
  --output data/review/review-decision.json
```

Decisiones soportadas:

- `APPROVE_PARTIAL`
- `APPROVE`
- `REJECT`
- `REQUEST_REVIEW`

Este comando no modifica datos por si mismo. Registra la decision auditada que luego puede habilitar o bloquear una promocion real.

## Promocion basada en decision

Para convertir approved bundles estructurales en un dataset revisado, cada
`LegalItem` debe estar cubierto por al menos una decision promotable:

- `APPROVE`
- `APPROVE_PARTIAL`

Comando:

```bash
node scripts/promote-reviewed-dataset.mjs \
  --approved data/approved/approved-bundle.json \
  --decision data/review/review-decision.json \
  --approved-by reviewer-id \
  --output data/approved/human-reviewed-approved-bundle.json
```

La salida marca:

```text
dataset.mode = HUMAN_REVIEWED
dataset.disposable = false
dataset.reviewScope = FULL | PARTIAL
```

Si falta una decision para algun item legal, o si la decision es `REJECT` o
`REQUEST_REVIEW`, la promocion falla.

Reglas adicionales:

- Una decision `APPROVE` no puede promover si todavia existen warnings o
  `requiresHumanReview = true`.
- Una decision `APPROVE_PARTIAL` puede promover un alcance limitado, dejando
  trazado `dataset.reviewScope = PARTIAL`.
- Warnings `HIGH` bloquean cualquier promocion salvo override explicito
  `--allow-high-warnings true`.
- Overrides como `--allow-review-warnings true` deben usarse solo con
  justificacion documentada en la decision.

El fixture de ejemplo del repositorio usa `APPROVE_PARTIAL` porque conserva
warnings de revision:

```bash
npm run validate:example
npm run review:partial-example
npm run promote:example
```

## Criterios para aprobar

Un dato puede aprobarse cuando:

- Tiene fuente verificable.
- Tiene citas suficientes.
- Respeta contratos.
- No contradice datos aprobados sin justificar la diferencia.
- Su estado legal y temporal es consistente.

## Criterios para rechazar

Un dato debe rechazarse cuando:

- No tiene fuente.
- La cita no respalda la afirmacion.
- La entidad esta mal clasificada.
- La relacion detectada no existe o es enganosa.
- El dato duplica informacion existente sin aportar version o cambio.

## Criterios para pedir revision

Un dato debe pasar a revision cuando:

- La fuente es valida pero la interpretacion no es obvia.
- Hay baja confianza automatica.
- Hay conflicto con otro dato.
- El impacto legal requiere criterio humano.
