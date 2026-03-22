# Estado del proyecto — documento para agentes externos

Este archivo describe **dónde está el repositorio hoy**, **cómo está montado** y **qué código es “producto” vs legado**. Úsalo como contexto al trabajar en `ai-travel-agent`; no sustituye a `AGENTS.md` ni a `docs/` sobre convenciones de código.

---

## Qué estamos construyendo

**Autonomous Travel Operator (ATO)**: no es un chatbot de FAQ. Es un **operador con gobierno** que intenta seguir el pipeline:

**Goal → Plan explícito → Simulación → Política de aprobación → Ejecución (pasos automáticos) → Decisiones (scoring) → Auditoría**

El dominio de viajes sigue siendo **mock** (vuelos/hoteles/reservas simuladas); la **arquitectura** está pensada para sustituir mocks por APIs reales sin rehacer el núcleo.

---

## Flujo HTTP principal (`POST /api/agent`)

La ruta [`src/app/api/agent/route.ts`](src/app/api/agent/route.ts) delega en **`ATOOrchestrator`**, no en el caso de uso antiguo.

1. **Sesión**: se crea un registro lógico y se persiste en Postgres (`ato_session`) cuando la BD está disponible.
2. **Planner** ([`PlannerService`](src/contexts/travel/trip/application/plan/PlannerService.ts)): una llamada al LLM pide **JSON de plan** (pasos con `type`, `args`, `dependsOn`). El sistema **valida con Zod**; si falla, hay **plan de respaldo** mínimo.
3. **Simulación** ([`SimulationService`](src/contexts/travel/trip/application/simulate/SimulationService.ts)): proyecta costes y detecta conflictos de dependencias **sin ejecutar** acciones irreversibles.
4. **Aprobación multinivel** ([`ApprovalPolicyService`](src/contexts/travel/trip/application/approve/ApprovalPolicyService.ts)): `auto` / `confirm` / `double` según tipo de paso y coste estimado.
5. **Ejecución**: para pasos `auto` con tool registrada, se llama a [`MockTravelTools`](src/contexts/travel/trip/infrastructure/tools/MockTravelTools.ts) vía [`executeWithResilience`](src/contexts/travel/trip/infrastructure/tools/ToolExecutor.ts) (reintentos + timeout). **No** se usa *function calling* del LLM en bucle aquí: el **sistema** recorre el plan y ejecuta `travelTools[step.type]`.
6. **Decision engine** ([`DecisionEngine`](src/contexts/travel/trip/application/decide/DecisionEngine.ts)): scoring precio/confort sobre resultados de búsquedas mock.
7. **Auditoría** ([`AuditLogger`](src/contexts/travel/trip/application/audit/AuditLogger.ts) + [`PostgresAuditRepository`](src/contexts/travel/trip/infrastructure/postgres/PostgresAuditRepository.ts)): eventos con actor `llm` | `system` | `user`.

La UI ([`ATOView`](src/app/_components/ATOView.tsx)) muestra plan, simulación, pendientes de aprobación, decisiones y trail de auditoría.

---

## Código legado: `TravelPlannerUseCase`

[`TravelPlannerUseCase`](src/contexts/travel/trip/application/plan/TravelPlannerUseCase.ts) implementa el patrón clásico **mensaje → LLM con `tools` + `tool_choice: "auto"` → bucle hasta respuesta final**. Sigue registrado en el contenedor DI como compatibilidad, pero **`/api/agent` no lo usa**. Si un agente externo busca “el bucle de tools en el LLM”, está en **este** archivo, no en `PlannerService`.

---

## Dónde vive qué (mapa rápido)

| Capa | Qué hay |
|------|---------|
| Dominio | `Plan`, `SimulationResult`, `ApprovalPolicy`, `DecisionRecord`, `Session`, `AuditEvent`, `ATOResponse`, tipos ADG en [`DecisionGraph.ts`](src/contexts/travel/trip/domain/DecisionGraph.ts) bajo [`src/contexts/travel/trip/domain/`](src/contexts/travel/trip/domain/) |
| Aplicación | `PlannerService`, `SimulationService`, `ApprovalPolicyService`, `DecisionEngine`, `AuditLogger`, `DecisionGraphWriter`, `GraphExecutor`, `ATOOrchestrator`, y el legado `TravelPlannerUseCase` |
| Infraestructura | `OpenAIClient`, `MockTravelTools`, `ToolExecutor`, repos Postgres (sesión, auditoría, ADG) |
| API | `src/app/api/agent/route.ts`, `src/app/api/health/route.ts` |
| UI | `src/app/page.tsx` + `ATOView` |
| Base de datos | [`databases/01_schema.sql`](databases/01_schema.sql) (meta + vector), [`databases/02_ato_schema.sql`](databases/02_ato_schema.sql) (`ato_session`, `ato_audit_event`), [`databases/03_adg_schema.sql`](databases/03_adg_schema.sql) (ADG: `adg_graph`, `adg_graph_version`, `adg_graph_node`, `adg_graph_edge`); `schema_version` en `app_meta` es `3` tras la migración ADG |

---

## Estado ADG (Autonomous Decision Graph) — hito 1

**Qué hay en base de datos hoy**

- Tras **`PlannerService.generate`**, el orquestador llama a [`DecisionGraphWriter`](src/contexts/travel/trip/application/graph/DecisionGraphWriter.ts) → [`PostgresAdgGraphRepository.insertPlanGraph`](src/contexts/travel/trip/infrastructure/postgres/PostgresAdgGraphRepository.ts) en una **transacción**:
  - Un **`adg_graph`** por ejecución, enlazado a `session_id` y al `plan_id` del plan validado.
  - Una **`adg_graph_version`** inicial (`version_number = 1`, `parent_version_id` NULL).
  - Nodo **`goal`** (`logical_id = "goal"`) con el texto del objetivo en `input`.
  - Un nodo **`plan_step`** por cada `PlanStep`, `logical_id = step.id`, `input` con args y metadatos; `in_progress` del plan se guarda como `pending` por el CHECK SQL.
  - Aristas **`depends_on`**: del nodo del paso dependiente al nodo del paso requerido (o al `goal` si `dependsOn` referencia `"goal"`).
- **Fase A (productor = [`ATOOrchestrator`](src/contexts/travel/trip/application/orchestrate/ATOOrchestrator.ts))**: sobre la misma `graph_version_id`, [`DecisionGraphWriter`](src/contexts/travel/trip/application/graph/DecisionGraphWriter.ts) añade nodos y aristas al avanzar el pipeline:
  - Tras simulación: nodo **`simulation`** (`logical_id = "simulation"`, resultado en `output`); cada **`plan_step`** `--produces-->` **simulation**; **simulation** `--depends_on-->` **goal**.
  - Por cada paso: nodo **`approval`** (`approval:{stepId}`) con nivel y motivo; **`plan_step`** `--influences-->` **approval**. Estado `completed` si `auto`, `blocked` si requiere confirmación o está pendiente.
  - Si el paso se ejecuta con tool: nodo **`execution`** (`execution:{stepId}`); **execution** `--depends_on-->` **approval** y **execution** `--depends_on-->` **plan_step**; `completed` o `failed` según el resultado.
  - Tras scoring en búsquedas: nodo **`decision`** (`decision:{decisionId}`); **decision** `--depends_on-->` **execution**.
- Si cualquier append falla, se hace **log** y el flujo principal **continúa** (misma filosofía que auditoría best-effort).

- **Fase B (MVP)**: [`GraphExecutor`](src/contexts/travel/trip/application/graph/GraphExecutor.ts) ejecuta el bucle de aprobación/tools/decisiones. El **orden** de los `plan_step` se obtiene con orden topológico desde Postgres ([`getPlanStepLogicalIdsTopologicalOrder`](src/contexts/travel/trip/infrastructure/postgres/PostgresAdgGraphRepository.ts)) según aristas `depends_on` entre pasos; si falla o no hay grafo, se usa el orden del `Plan`. El [`ATOOrchestrator`](src/contexts/travel/trip/application/orchestrate/ATOOrchestrator.ts) sigue creando sesión, plan, simulación y delegando la fase de pasos al executor.

**Tipos de dominio**: [`DecisionGraph.ts`](src/contexts/travel/trip/domain/DecisionGraph.ts) (`AdgGraph*`, `PersistedPlanGraph`).

**Respuesta HTTP**: [`ATOResponse`](src/contexts/travel/trip/domain/ATOResponse.ts) puede incluir `adgGraphId` y `adgGraphVersionId` cuando la persistencia tuvo éxito; la UI ([`ATOView`](src/app/_components/ATOView.tsx)) las muestra de forma opcional.

**Qué no está aún (roadmap)**

- **Motor solo-grafo**: leer args y tipo de paso **solo** desde nodos ADG (hoy el `Plan` en memoria sigue siendo la fuente de verdad para args).
- **Hito versionado avanzado**: ramas (`parent_version_id`), invalidación parcial del subárbol y replan explícito en el grafo; diseño ampliado en [`feedback.md`](feedback.md).

---

## LLM y entorno

- Proveedor configurable: **Ollama** (por defecto) u **OpenAI** vía [`resolveLlmConnection`](src/contexts/travel/trip/infrastructure/ai/resolveLlmConnection.ts).
- Variables: ver [`.env.example`](.env.example) (`LLM_PROVIDER`, `LLM_MODEL`, `DATABASE_URL`, etc.).
- Docker: [`docker-compose.yml`](docker-compose.yml) proyecto `ia-travel`, Postgres en host **15432** por defecto; Ollama opcional con perfil `bundled-ollama`.

---

## Mock vs real (honestidad técnica)

- **Mock**: datos de vuelos/hoteles/reservas, costes de simulación simplificados, ausencia de APIs de proveedores o pagos.
- **Real en código**: pipeline ATO, validación de plan, políticas, scoring, persistencia de sesión/eventos cuando Postgres responde, retries en ejecución de tools.

---

## Qué falta o es siguiente salto natural

- **Continuidad conversacional**: rehidratar mensajes/plan entre peticiones usando `sessionId` (tabla existe; el orquestador aún no reconstruye historial largo para el LLM en cada turno).
- **Aprobaciones en UI/API**: hoy se listan pendientes; falta endpoint que aplique “confirmar / rechazar con feedback” y re-ejecute o replanifique.
- **Replanificación explícita** tras fallo (más allá de retries de tool).
- **Integraciones reales** sustituyendo solo la capa `infrastructure/tools`.

---

## Frase guía

> We are building a system that doesn’t just suggest actions, but plans, simulates, and executes them under controlled conditions.

---

## Nota sobre textos antiguos en este archivo

Versiones anteriores mezclaban **feedback genérico de un agente externo** (roadmap, “session state recomendado”) con la descripción del repo. Gran parte de ese roadmap **ya se implementó** (planner explícito, simulación, aprobación por niveles, auditoría, sesión en Postgres, resiliencia en tools). Lo que queda pendiente está en la sección **“Qué falta”** de arriba.
