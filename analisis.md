# AI Travel Agent (ATO): qué ofrece la app y flujo end-to-end

Documento orientado a producto y a desarrollo. Describe el comportamiento real del código en este repositorio (Next.js 16, orquestador `ATOOrchestrator`, ejecución `GraphExecutor`, LLM vía OpenAI-compatible, Postgres para sesión y auditoría).

---

## 1. Qué es la aplicación

- **Interfaz**: workspace de viajes (objetivo en lenguaje natural, preferencias opcionales de presupuesto y peso precio/confort, cronología de auditoría, pasos del plan y catálogos cuando aplica).
- **Cerebro**: un **planificador LLM** que devuelve JSON estructurado (`plan` con pasos tipados o `need_input` si faltan datos).
- **Ejecución controlada**: tras un plan válido, un motor ejecuta herramientas (`search_flights`, `search_hotels`, etc.) en orden con dependencias, con **human-in-the-loop (HITL)** para elegir vuelo y hotel entre opciones rankeadas.
- **Persistencia**: sesión y preferencias en **Postgres**; **grafo de decisiones (ADG)** y eventos de auditoría para trazabilidad.
- **Vuelos reales o mock**: según `FLIGHT_SEARCH_PROVIDER` (`mock` por defecto, o `fli` con puente Python). Ver `docs/flight-search-provider.md`.

---

## 2. Punto de entrada del usuario (primera descripción)

1. El usuario escribe un **objetivo de viaje** (texto libre) en el workspace.
2. Opcionalmente ajusta **preferencias** enviadas al API: `maxPriceUsd`, `priceWeight`, `comfortWeight` (la UI suele exponer slider precio/confort y campo de presupuesto máximo).
3. La UI llama **`POST /api/agent`** con cuerpo JSON típico:
   - `message`: objetivo del viaje.
   - `preferences` (opcional).
   - `sessionId` (opcional): si ya hay sesión, se reutiliza.

4. El **`ATOOrchestrator`**:
   - Crea o carga sesión en Postgres.
   - Fusiona slots guardados (`gatheredSlots` en preferencias) con lo nuevo.
   - Llama a **`GenerateTravelPlan`** con el mensaje y los slots reunidos.

---

## 3. Detección de datos faltantes (el LLM “pide fechas” u otros datos)

El planificador puede responder de dos formas principales:

### 3.1 `need_input` → fase API `awaiting_input`

- El modelo devuelve JSON con `kind: "need_input"`, un **`assistantMessage`** (pregunta o explicación) y **`missingSlots`**: lista de campos con `id`, `role` y `label`.
- **Roles cerrados** (dominio): `outbound_date`, `return_date`, `destination`, `origin` (este último añadido para recuperación y formularios).
- Si el usuario habla de “navidades” o “en abril” **sin fechas en calendario ISO**, el prompt del planner obliga a **no inventar fechas** y a pedir `need_input` con fechas concretas (`YYYY-MM-DD`).

### 3.2 Cómo continúa el usuario

- La UI muestra el mensaje del asistente y **formularios por slot**:
  - `destination` y `origin`: input de texto (ciudad o IATA).
  - Fechas: input tipo fecha.
- Al pulsar continuar, la UI llama **`POST /api/agent`** con:
  - `sessionId`
  - `slotValues`: mapa `{ [slot.id]: valor }` (no hace falta repetir `message` si solo se envían slots; el servidor acepta continuación solo con slots).

Los valores se **persisten** en la sesión (`gatheredSlots`) y el siguiente plan del LLM los ve en el prompt como **[Gathered travel data]**. Además, en **`planFromValidatedDraftBody`** se **fusionan** con los pasos `search_flights` (p. ej. `recovery_origin` / `recovery_destination` tras un fallo de vuelo).

### 3.3 Fechas ya completas

- Si en `gatheredSlots` hay **ida y vuelta** en formato **`YYYY-MM-DD`** (claves `outbound`/`outbound_date` y `return`/`return_date`), `GenerateTravelPlan` usa la variante de prompt **`confirmed_dates`**: el modelo debe devolver un `plan` sin volver a pedir esas fechas, y puede usarse plantilla de respaldo (`DefaultLeisureTripPlanTemplate`) si el JSON del plan no valida.

---

## 4. Cuando hay plan completo: simulación, grafo y ejecución

1. **Auditoría**: evento `plan_generated`.
2. **ADG**: `DecisionGraphWriter.persistPlanGraph` guarda el grafo (versión asociada a la sesión). Si falla, el flujo puede seguir sin `graphVersionId` (con limitaciones en selección interactiva).
3. **`SimulationService.simulate(plan)`**: estimación de costes por tipo de paso, detección de conflictos de dependencias y reglas del estilo “no reservar vuelo sin búsqueda previa”.
4. **`GraphExecutor.runPlanStepExecutionPhase`**:
   - Ordena pasos por **dependencias** (topológico desde Postgres si hay grafo, si no por el plan).
   - Para cada paso: **política de aprobación** (`ApprovalPolicyService`); si es `auto`, ejecuta la herramienta del **`TravelToolCatalog`**.

---

## 5. Vuelos: de “salen todos los vuelos” a la selección

### 5.1 Ejecución de `search_flights`

- La herramienta valida argumentos (Zod), rechaza placeholders literales `Origin`/`Destination`, y delega en **`FlightSearchPort`**:
  - **mock**: tres ofertas de ejemplo.
  - **fli**: proceso Python (`fli_search_bridge.py`) con normalización de ciudades a IATA donde hay alias.

### 5.2 Ranking (no es el usuario quien ve “todos los vuelos crudos” sin filtrar)

- Tras una ejecución **exitosa**, los resultados pasan por **`DecisionEngine.rank`** (precio vs confort según pesos del usuario y opcionalmente `maxPriceUsd`).
- Se construye un **`DecisionRecord`** con opciones puntuadas y una recomendación; en paralelo se persisten nodos del grafo (`selection_request`, etc., cuando hay `graphVersionId`).

### 5.3 Cómo **selecciona el usuario** un vuelo (HITL)

1. La respuesta API pasa a **`phase: awaiting_selection`** con **`pendingSelections`**: primer ítem suele ser el vuelo (`selectionKind: "flight"`), con opciones resumidas (`id`, `label`, `priceUsd`, detalles de vuelo si aplica).
2. En la UI, el usuario **elige una opción** (tarjeta / botón).
3. Eso dispara dos pasos en cadena (ver `useWorkspaceAgent.selectCatalogOption`):
   - **`POST /api/graph/select`**: registra en backend `sessionId`, `graphVersionId`, `selectionRequestLogicalId`, `selectedOptionId`.
   - **`POST /api/agent`** con **`resumeExecution: true`** y el mismo `sessionId`: el orquestador **reanuda** el `GraphExecutor` con un **checkpoint** (pasos ya completincludes la selección aplicada al grafo).
4. El motor continúa con el **siguiente paso** del plan (normalmente **`search_hotels`**, que depende transitivamente del vuelo).

Sin `graphVersionId` válido, la condición para pausar en selección interactiva puede no cumplirse según el código; en entorno sano con ADG persistido, el flujo anterior es el previsto.

### 5.4 Si el vuelo falla o no hay ofertas elegibles

- El ejecutor devuelve **`executionPhase: blocked`** con `flightBlock` (`flight_tool_failed` o `no_flight_offers`).
- **No** se ejecutan hoteles hasta tener un camino de vuelo válido (diseño explícito).
- **Recuperación**: el orquestador llama a **`FlightRecoveryPort`** (LLM + fallback) y responde **`awaiting_input`** con mensaje y slots (p. ej. origen/destino/fechas), manteniendo contexto de error en `flightSearchBlock` para la UI. Los slots `recovery_*` se aplican de forma prioritaria al ensamblar el siguiente plan.

---

## 6. Hoteles

- Paso **`search_hotels`**: misma idea — ejecución del tool (mock u otro), ranking con **`DecisionEngine`**, y si aplica **`awaiting_selection`** con `selectionKind: "hotel"`.
- Selección humana otra vez vía **`POST /api/graph/select`** + **`resumeExecution`**.

---

## 7. Fase `ready` y cierre

- Si no hay más aprobaciones pendientes ni selecciones pendientes, el executor termina; la sesión puede quedar `completed` (u otros estados según aprobaciones).
- La respuesta incluye **plan**, **simulación**, **decisiones**, **pasos ejecutados**, **auditoría** (`auditEvents`), **resumen** (`summary`).

### `phase: blocked` (legado)

- El tipo **`blocked`** sigue existiendo en el contrato `ATOResponse` por si algún flujo lo devuelve; el camino principal tras fallo de vuelo con recuperación es **`awaiting_input`** con `flightSearchBlock`, no un callejón sin formulario.

---

## 8. APIs relevantes (resumen)

| Endpoint | Rol |
|----------|-----|
| `POST /api/agent` | Mensaje inicial, continuación con `slotValues`, `resumeExecution` tras selección. |
| `POST /api/graph/select` | Registra la opción humana elegida para un `selection_request` del grafo. |
| `POST /api/agent/choose` | Flujo legacy/adjunto al use case antiguo (ver código si se usa desde UI). |
| `GET /api/health` | Salud del servicio. |

---

## 9. Observabilidad y depuración

- **Auditoría**: `session_created`, `input_required`, `plan_generated`, `simulation_run`, `tool_called`, `tool_failed`, `step_blocked`, `flight_recovery_input_required`, etc.
- **Vuelos**: variable de entorno `ATO_FLIGHT_DEBUG=1` en el proceso Node → logs `[ATO][search_flights]` en la terminal del servidor (ver `docs/flight-search-provider.md`).

---

## 10. Idea clave de producto

La app no es “un chat que reserva”: es un **operador de viajes** que **estructura** el viaje en pasos, **proyecta** costes y riesgos, **ejecuta** búsquedas con límites (aprobación, placeholders bloqueados, bloqueo vuelo→hotel), y **mete al humano en el circuito** donde el catálogo y la decisión importan (elección de vuelo y hotel), con **recuperación guiada** cuando algo falla.
