# LexMapa Datavalidation

Repositorio publico para validacion, revision, auditoria y promocion de datos legales candidatos.

## Responsabilidad

`legal-datavalidation` es la puerta de calidad entre la ingesta y los datos aprobados.

Puede:

- Recibir datos candidatos desde `legal-datacollection`.
- Ejecutar validaciones automaticas.
- Marcar datos como pendientes de revision.
- Registrar decisiones humanas.
- Aprobar o rechazar candidatos.
- Promover datos aprobados.
- Informar freshness y cambios pendientes.

No puede:

- Hacer scraping de fuentes externas como tarea principal.
- Exponer APIs publicas de consulta final.
- Ocultar incertidumbre.
- Aprobar interpretaciones sin fuente verificable.

## Por que es critico

El valor de LexMapa depende de diferenciar:

- Dato raw.
- Dato parseado.
- Dato candidato.
- Dato aprobado.
- Dato rechazado.
- Dato pendiente de revision.

Sin esta capa, el sistema correria el riesgo de mostrar extracciones automaticas como si fueran verdad legal validada.

## Documentacion

- [Arquitectura](./docs/ARCHITECTURE.md)
- [Pipeline de validacion](./docs/VALIDATION_PIPELINE.md)
- [Decisiones de revision](./docs/REVIEW_DECISIONS.md)

