# Pipeline de validacion

## Flujo principal

```mermaid
flowchart TD
  Candidate["Candidate data"] --> Schema["Validacion de esquema"]
  Schema --> Citation["Validacion de citas"]
  Citation --> Temporal["Consistencia temporal"]
  Temporal --> Relationship["Consistencia de relaciones"]
  Relationship --> Confidence["Evaluacion de confianza"]
  Confidence --> Decision{"Decision"}
  Decision -->|Aprobar| Approved["Approved data"]
  Decision -->|Rechazar| Rejected["Rejected data"]
  Decision -->|Revisar| Review["Cola de revision"]
  Review --> Decision
```

## Validaciones minimas

### Esquema

- Todos los ids requeridos existen.
- Los enums pertenecen a `legal-contracts`.
- Fechas en formato ISO.
- Relaciones apuntan a entidades existentes.

### Citas

- Toda regla interpretada tiene al menos una cita.
- Toda relacion normativa tiene fuente.
- Toda explicacion simple puede volver a una fuente verificable.

### Tiempo

- `effectiveTo` no puede ser anterior a `effectiveFrom`.
- Cambios historicos deben tener fecha de publicacion o entrada en vigencia cuando la fuente lo permita.
- Snapshots deben indicar fecha.

### Confianza

- Datos generados automaticamente empiezan como `AUTO_EXTRACTED`.
- Datos con baja confianza pasan a `NEEDS_REVIEW`.
- Datos sin cita no pueden aprobarse como interpretacion.

## Salidas

- `APPROVED`: dato validado para consumo.
- `REJECTED`: dato descartado con razon.
- `NEEDS_REVIEW`: dato pendiente de revision humana.

## CLI inicial

El repositorio incluye una CLI minima para validar un candidate bundle y generar un approved bundle de prueba:

```bash
npm run validate:example
```

El comando lee:

```text
examples/candidate-bundle.example.json
```

y escribe:

```text
data/approved/approved-bundle.example.generated.json
```

Esta CLI no reemplaza la revision humana. Es el primer esqueleto funcional para validar estructura, referencias y citas minimas.

Tambien genera un reporte estructural:

```text
data/reports/validation-report.example.generated.json
```

El reporte marca:

- Cobertura de citas por disposicion.
- Citas cuyo texto no coincide exactamente con la disposicion.
- Etiquetas de disposiciones duplicadas.
- Items o disposiciones con estado `DESCONOCIDO`.
- Si el bundle requiere revision humana antes de tratarse como aprobado legalmente.

El approved bundle generado por esta CLI debe entenderse como salida tecnica para probar integracion downstream. La aprobacion legal real requiere decision auditada.

## Flujo 1: dataset estructural de desarrollo

Para construir un dataset descartable desde los candidates generados por `legal-datacollection`:

```bash
npm run build:dev-dataset
```

Salida:

```text
data/dev/dev-structural-approved-bundle.generated.json
```

Este bundle incluye:

- `dataset.mode = DEV_STRUCTURAL`
- `dataset.disposable = true`
- read models para backend/frontend
- resumen de reportes de validacion

No debe usarse como aprobacion legal real.

Para exportar los read models de ese bundle a SQL compatible con D1:

```bash
npm run export:d1:dev
```

Salida:

```text
data/d1/dev-structural-read-models.generated.sql
```

Para generar una version compatible con `wrangler d1 execute --remote`, sin
`BEGIN TRANSACTION`/`COMMIT`:

```bash
npm run export:d1:dev:remote
```

## Flujo 2: revision y aprobacion real

El flujo de aprobacion real debe usar:

- candidate bundle
- reporte de parsing
- reporte de validacion
- checklist de revision humana
- decision auditada

Hasta que exista esa decision, el dato puede visualizarse como desarrollo o pendiente, pero no como dato legal aprobado.

### Registro de decision

Ejemplo de decision que habilita promocion:

```bash
npm run validate:example
npm run review:partial-example
```

Las decisiones que habilitan promocion son:

- `APPROVE`
- `APPROVE_PARTIAL`

Las decisiones `REJECT` y `REQUEST_REVIEW` bloquean la promocion.

Reglas de promocion:

- `APPROVE` exige que no queden warnings ni senales de revision humana.
- `APPROVE_PARTIAL` permite publicar un alcance parcial revisado, dejando el
  dataset marcado con `reviewScope = PARTIAL`.
- Cualquier warning `HIGH` bloquea la promocion salvo override explicito
  `--allow-high-warnings true` con justificacion documentada.
- Si se necesita aprobar con warnings no criticos, debe usarse
  `APPROVE_PARTIAL` o `--allow-review-warnings true` con justificacion.

### Promocion a dataset revisado

Para promover un approved bundle solo cuando existe una decision auditada:

```bash
npm run promote:example
```

Salida:

```text
data/approved/human-reviewed-approved-bundle.example.generated.json
```

El bundle generado incluye:

- `dataset.mode = HUMAN_REVIEWED`
- `dataset.disposable = false`
- `dataset.reviewScope = FULL` o `PARTIAL`
- `dataset.promotionGate` con conteo de warnings y overrides usados
- referencias a las decisiones de revision usadas

Para exportarlo a SQL remoto de D1:

```bash
npm run export:d1:reviewed:example
```

## Limpieza de datos de desarrollo

Antes de preparar un corte productivo:

```bash
npm run clean:dev-data
```

Ese comando elimina salidas descartables de `legal-datavalidation`:

- `data/dev`
- `data/d1`
- `data/reports/dev`

Opcionalmente puede borrar decisiones/revisiones o salidas aprobadas generadas:

```bash
node scripts/clean-dev-data.mjs --include-review-decisions
node scripts/clean-dev-data.mjs --include-approved
```

Para limpiar tambien artefactos generados por `legal-datacollection`:

```bash
node scripts/clean-dev-data.mjs --include-datacollection
```
