# ADG: semántica de nodos interactivos

Contrato de producto alineado con el grafo pausable (planner propone, sistema ejecuta, usuario elige en hitos). Ver también [sistema_interactivo_por_etapas.md](../../sistema_interactivo_por_etapas.md).

**Migración Postgres:** aplicar [`databases/04_adg_interactive_nodes.sql`](../../databases/04_adg_interactive_nodes.sql) tras `03_adg_schema.sql` (`schema_version` → `4`).

## Tipos de nodo (`adg_graph_node.node_type`)

| Tipo | Rol |
|------|-----|
| `goal` | Ancla de intención; no ejecuta herramientas. |
| `plan_step` | Paso del plan (búsqueda, reserva, etc.). |
| `decision` | Ranking/scoring automático sobre opciones ya materializadas. |
| `selection_request` | Barrera **humana**: publica opciones y queda en `waiting_user`. |
| `selection_result` | Hecho consolidado: opción elegida; desbloquea el siguiente tramo. |
| `simulation` | Agregado coste/factibilidad (puede ser preliminar o tras elecciones). |
| `approval` | Barrera de **política** (`waiting_approval`): riesgo/importe/doble confirmación. |
| `execution` | Invocación de tool tras aprobación cuando aplica. |

`audit` no es nodo del ADG; vive en `ato_audit_event`.

## Estados (`adg_graph_node.status`)

| Estado | Significado |
|--------|-------------|
| `pending` | Existe; dependencias no satisfechas. |
| `ready` | Listo para entrar en cola de ejecución. |
| `running` | El motor está procesándolo. |
| `waiting_user` | Esperando elección explícita (`selection_request`). |
| `waiting_approval` | Esperando política (`approval` no auto). |
| `completed` | Cerrado correctamente. |
| `blocked` | Bloqueo heredado (p. ej. compat); preferir `waiting_approval` para aprobaciones. |
| `failed` | Error. |
| `cancelled` | Abort explícito. |
| `skipped` | Rama no activa. |

## Contrato JSON: `selection_request`

Persistido en `input` del nodo (y expuesto a la UI vía API).

```json
{
  "selectionKind": "flight",
  "title": "Elige tu vuelo",
  "stepId": "step-1",
  "decisionId": "uuid-de-la-decision",
  "options": [
    { "id": "f1", "label": "Vueling (08:30→10:15) $120", "priceUsd": 120 }
  ]
}
```

- `selectionKind`: `"flight"` \| `"hotel"` (extensible).
- `options[].id`: estable para validar el POST de selección.

**`logical_id`:** `selection_request:{decisionId}`.

## Contrato JSON: `selection_result`

Persistido en `output` del nodo.

```json
{
  "selectedOptionId": "f1",
  "selectionRequestLogicalId": "selection_request:…",
  "decisionId": "uuid-de-la-decision"
}
```

**`logical_id`:** `selection_result:{decisionId}`.

## Aristas

- `selection_request` **depends_on** `decision:{id}` (el request no existe sin ranking previo).
- `selection_result` **depends_on** `selection_request:{id}`.

Tipos de arista existentes: `depends_on`, `produces`, `influences`.

## API `POST /api/graph/select`

Cuerpo:

```json
{
  "sessionId": "…",
  "graphVersionId": "…",
  "selectionRequestLogicalId": "selection_request:…",
  "selectedOptionId": "f1"
}
```

Valida que la opción exista en el payload del `selection_request`, crea/actualiza `selection_result`, marca el request como `completed` y actualiza el checkpoint de sesión para reanudar con `resumeExecution` en `POST /api/agent`.

## Checkpoints de sesión (`ato_session.preferences`)

Claves reservadas:

- `checkpointPlan` — plan serializado (ISO dates) para no replanificar en reanudación.
- `graphExecutionCheckpoint` — progreso del motor (`fullyCompletedStepIds`, resultados parciales, `graphVersionId`).

El cliente reanuda con `{ "sessionId", "resumeExecution": true }` cuando la sesión está en `awaiting_selection`.
