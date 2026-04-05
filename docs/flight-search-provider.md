# Proveedor de búsqueda de vuelos (`FlightSearchPort`)

El ATO ejecuta la capacidad **`search_flights`** igual que antes; lo que cambia es el **adaptador de infraestructura** detrás del puerto de dominio:

- **`mock`** (por defecto): respuestas sintéticas, sin Python ni red hacia Google Flights.
- **`fli`**: puente Python que usa el paquete PyPI `flights` (librería **fli**) y devuelve ofertas normalizadas.

Configuración: ver `.env.example` (`FLIGHT_SEARCH_PROVIDER`, `FLIGHT_SEARCH_PYTHON`, `FLI_BRIDGE_*`).

**Diagnóstico de `search_flights`:** añade `ATO_FLIGHT_DEBUG=1` a `.env.local` y **reinicia** `npm run dev` (solo carga en el proceso Node). Los mensajes van a la **terminal del servidor** (no a la consola del navegador): busca el prefijo `[ATO][search_flights]`. Hay dos líneas: `query` (args tras Zod, **antes** de rechazar placeholders o llamar al puerto) y `step` (en el ejecutor del grafo: `stepId` + `args`). Para filtrar: `npm run dev 2>&1 | grep '\[ATO\]\[search_flights\]'`.

## Probar con mock (rápido)

1. Asegúrate de tener `.env.local` (p. ej. `cp .env.example .env.local`).
2. Deja `FLIGHT_SEARCH_PROVIDER=mock` o no definas la variable (el código usa `mock` por defecto).
3. Levanta Postgres y el LLM según [README](../README.md).
4. `npm run dev` y usa la UI o `POST /api/agent` como siempre.
5. Cuando el plan incluya `search_flights`, los resultados serán los del mock (tres ofertas de ejemplo).

Comprobación automática sin UI:

```bash
npm test
```

(incluye tests del catálogo de tools con el mock).

## Probar con `fli` (vuelos reales vía bridge)

Requisitos:

- **Python 3.10+** con dependencias del bridge instaladas.
- Ejecutar **Next desde la raíz del repo** (`process.cwd()` resuelve la ruta del script `fli_search_bridge.py`).

Pasos sugeridos:

```bash
# Entorno Python dedicado (recomendado)
python3 -m venv .venv-fli
.venv-fli/bin/pip install -r src/contexts/travel/trip/infrastructure/flights/fli/requirements-fli.txt
```

En `.env.local`:

```bash
FLIGHT_SEARCH_PROVIDER=fli
FLIGHT_SEARCH_PYTHON=/ruta/absoluta/al/repo/.venv-fli/bin/python
# opcional: FLI_BRIDGE_TIMEOUT_MS=90000
```

Luego `npm run dev` y un flujo que genere un paso `search_flights` con **fechas futuras** y códigos que el bridge entienda (IATA; el bridge mapea metacódigos como `PAR` → `CDG`). Si la fecha está en el pasado, la librería **fli** puede rechazar la petición.

### Probar solo el bridge (sin Next)

Desde la raíz del repo:

```bash
echo '{"from":"BCN","to":"CDG","date":"2026-12-23"}' | .venv-fli/bin/python src/contexts/travel/trip/infrastructure/flights/fli/fli_search_bridge.py
```

El bridge normaliza y **mapea nombres de ciudad** a IATA cuando el modelo envía texto en lugar de códigos (p. ej. `hamburgo` / `Hamburg` → `HAM`). Ejemplo:

```bash
echo '{"from":"BCN","to":"hamburgo","date":"2026-12-20"}' | .venv-fli/bin/python src/contexts/travel/trip/infrastructure/flights/fli/fli_search_bridge.py
```

Salida esperada: JSON con `"ok": true` y `"offers": [...]`, o `"ok": false` con `code` / `message` si falla red, validación o entorno.

## Arquitectura (recordatorio)

- Dominio: `FlightSearchPort`, `FlightSearchQuery`, `NormalizedFlightOffer` en `src/contexts/travel/trip/domain/`.
- Catálogo de tools: `TravelToolCatalog` — `search_flights.execute` solo delega al puerto.
- DI: `src/contexts/shared/infrastructure/dependency-injection/diod.config.ts` elige implementación según `FLIGHT_SEARCH_PROVIDER`.

El planner **no** debe mencionar `fli`; solo produce pasos `search_flights` con args de producto.

## Limitaciones y riesgos

- Acceso no oficial a datos de mercado: posibles cambios de API, bloqueos o variación de resultados.
- CI y tests de aplicación deben seguir usando **mock**; no dependas de búsquedas reales en `npm test`.
