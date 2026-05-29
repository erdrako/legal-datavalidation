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
