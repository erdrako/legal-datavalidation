# Checklist de revision humana

## Objetivo

Esta checklist define los controles minimos antes de promover datos reales importados desde una fuente oficial a approved data.

La primera aplicacion practica es el candidate bundle de Ley 24.240 importado desde InfoLEG.

## 1. Fuente

Verificar:

- La URL corresponde a una fuente oficial o publica confiable.
- La fuente indica texto actualizado o alcance equivalente.
- La fecha de recuperacion esta registrada.
- El raw HTML fue guardado.
- El reporte de parsing incluye hash SHA-256 del raw.

Evidencia esperada:

- URL.
- Fecha de recuperacion.
- Hash del documento raw.

## 2. Segmentacion

Verificar:

- Todos los articulos esperados fueron detectados.
- Los articulos con sufijo, como `bis`, `ter` o `quater`, no fueron mezclados con el articulo base.
- No hay encabezados tratados como articulos.
- No hay notas de InfoLEG pegadas a una provision equivocada.
- Los articulos muy cortos o duplicados estan revisados.

Evidencia esperada:

- Reporte de parsing.
- Conteo total de articulos.
- Lista de advertencias.

## 3. Citas

Verificar:

- Cada `LegalProvision` tiene al menos una `LegalCitation`.
- Cada cita apunta al `LegalItem` correcto.
- Cada cita apunta a la provision correcta.
- `citation.originalText` coincide con `provision.textOriginal`.
- La cita conserva URL y fecha de recuperacion.

No aprobar si:

- Una provision no tiene cita.
- Una cita no respalda exactamente la provision.
- Una cita apunta a otro articulo o item legal.

## 4. Estado legal

Verificar:

- Si hay evidencia suficiente para marcar el item como `VIGENTE`.
- Si hay articulos derogados, sustituidos o historicos que deban marcarse de forma separada.
- Si el importador solo puede afirmar estructura y fuente, pero no vigencia.

Decision conservadora:

- Mantener `DESCONOCIDO` cuando no haya validacion suficiente.
- Usar `VIGENTE` solo con evidencia documentada.
- Usar `NEEDS_REVIEW` para cualquier interpretacion dudosa.

## 5. Datos que no deben aprobarse todavia

No promover como verdad final:

- Reglas semanticas no extraidas o no revisadas.
- Relaciones modificatorias no verificadas.
- Vigencia articulo por articulo no confirmada.
- Sujetos afectados inferidos automaticamente sin revision.
- Obligaciones, prohibiciones, derechos o sanciones sin cita especifica.

## 6. Decision

Una decision de revision debe registrar:

- Bundle revisado.
- Fuente revisada.
- Reporte de parsing revisado.
- Reporte de validacion revisado.
- Decision: aprobar, rechazar o pedir revision.
- Motivo.
- Revisor.
- Fecha.

## 7. Criterio para primera aprobacion parcial

Para la primera demo puede aprobarse parcialmente:

- `LegalItem`
- `LegalProvision`
- `LegalCitation`

sin aprobar todavia:

- `LegalRule`
- `LegalRelationship`
- `LegalConcept`
- `LegalChange`
- `LegalSnapshot`

Esa aprobacion parcial debe comunicarse en frontend como datos estructurales validados, no como interpretacion legal completa.

