# AI Travel Agent (ATO)

**Operador de viajes asistido por LLM**, con arquitectura **DDD / hexagonal**, orquestación **propia** y **sin frameworks de agentes de terceros** (no LangChain ni similares). El modelo de IA se usa **de forma nativa** mediante el SDK oficial `openai` (compatible con **OpenAI** y con **Ollama** u otros endpoints `/v1`).

## Qué hemos conseguido

- **Agente de viajes “de verdad” en código propio**: el flujo no está cableado con cadenas genéricas; hay un **orquestador** (`ATOOrchestrator`) que encadena pasos con reglas de dominio claras.
- **Planner LLM estructurado**: el LLM devuelve JSON validado con **Zod** — o bien un **`plan`** con pasos tipados (`search_flights`, `search_hotels`, etc.) o bien **`need_input`** con *slots* (fechas, destino…) para la UI.
- **Cuando las fechas ya están recogidas**, el planner entra en una vía que **no vuelve a pedir calendario**: o bien un prompt estricto solo-`plan`, o un **plan mínimo determinista** en código si el modelo falla el JSON — consistencia antes que repetir preguntas al usuario.
- **Motor de ejecución sobre grafo (ADG)**: los planes se **persisten** en PostgreSQL como grafo de decisión; hay **orden topológico**, **auditoría** y trazabilidad.
- **Simulación previa a ejecutar**: estimación de costes, conflictos de dependencias y factibilidad **sin side effects** reales.
- **Human-in-the-loop nativo**: en búsquedas interactivas el ejecutor **se detiene** en `awaiting_selection`; el usuario elige vuelo/hotel; se reanuda con **`POST /api/graph/select`** + **`resumeExecution`** en `/api/agent`.
- **API REST delgada** (`src/app/api/`) que delega en servicios del dominio inyectados con **diod**.
- **Workspace premium en el front**: flujo guiado por **etapas** (definición → vuelo → hotel → revisión → aprobación → operación), derivado de `ATOResponse`; tokens de color semánticos y componentes React (**Next.js 16**, **Tailwind**).

En resumen: **orquestación y “agente” son vuestro código**; el LLM es un **servicio** que planifica o redacta, no el dueño del flujo.

## Por qué no LangChain (ni stacks equivalentes)

- **Control total** del grafo de decisión, persistencia, auditoría y formatos de entrada/salida.
- **Menos magia oculta**: menos capas intermedias entre el prompt y el contrato JSON del dominio.
- **Dependencias acotadas**: `openai`, `zod`, `pg`, `diod` — fácil de auditar y desplegar.

Si en el futuro se quisiera un framework de agentes, el núcleo seguiría siendo el mismo dominio; solo cambiaría la capa que llama al modelo.

## Arquitectura (resumen)

```
Usuario / UI
    → POST /api/agent (mensaje, sesión, preferencias, slotValues, resumeExecution)
    → ATOOrchestrator.run
         → Sesión + preferencias (Postgres)
         → PlannerService (LLM + Zod) → Plan o need_input
         → DecisionGraphWriter → ADG en Postgres
         → SimulationService → resultado simulado
         → GraphExecutor → tools mock + rankings + checkpoints HITL
    → ATOResponse (phase: awaiting_input | awaiting_selection | ready)
```

Carpetas principales:

| Área | Ruta |
|------|------|
| API Next.js | `src/app/api/` |
| UI workspace | `src/app/_components/ato-workspace/` |
| Dominio viajes | `src/contexts/travel/trip/domain/` |
| Aplicación | `src/contexts/travel/trip/application/` |
| Infraestructura (PG, OpenAI) | `src/contexts/travel/trip/infrastructure/` |
| Inyección de dependencias | `src/contexts/shared/infrastructure/dependency-injection/` |

## Endpoints relevantes

- **`POST /api/agent`** — Punto principal del agente: crear/continuar sesión, enviar objetivo, `slotValues` cuando el planner pidió datos, `resumeExecution: true` tras selección de catálogo.
- **`POST /api/graph/select`** — Registrar elección del usuario sobre una petición de selección pendiente (vuelo/hotel).
- **`POST /api/agent/choose`** — Elección sobre una decisión concreta (`decisionId`); flujo distinto del select de grafo.
- **`GET /api/health`** — Comprobación de servicio.

## Requisitos

- **Node.js** (ver `package.json` para scripts).
- **PostgreSQL** (esquema del proyecto; ver `databases/` y `docker-compose` si aplica).
- **LLM**: Ollama local/remoto **o** API OpenAI/compatible (variables en `.env.example`).

## Puesta en marcha

1. Copiar entorno:

   ```bash
   cp .env.example .env.local
   ```

2. Levantar Postgres (y opcionalmente Ollama con perfil del compose):

   ```bash
   npm run docker:up
   # o
   npm run docker:up:with-ollama
   ```

3. Instalar dependencias y ejecutar en desarrollo:

   ```bash
   npm install
   npm run dev
   ```

4. Calidad:

   ```bash
   npm run lint
   npm test
   npm run build
   ```

Convenciones detalladas de código y capas: **`docs/`** y **`AGENTS.md`**.

## Búsqueda de vuelos (mock vs proveedor real)

El paso `search_flights` usa un **puerto de dominio** con implementación configurable:

- Por defecto: **mock** (sin Python).
- Opcional: **`fli`** vía script Python y variable `FLIGHT_SEARCH_PROVIDER` (ver `.env.example`).

Instrucciones de prueba y requisitos: **[`docs/flight-search-provider.md`](docs/flight-search-provider.md)**.

## Licencia / equipo

Proyecto privado (`"private": true` en `package.json`). Ajustad esta sección según vuestra política interna.
