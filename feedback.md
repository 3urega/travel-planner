Perfecto. Te lo voy a estructurar como **roadmap de producto + arquitectura aterrizado al ATO real que ya tenéis**, no como lista genérica de “features bonitas”.

La idea es priorizar **lo que más cambia la percepción del usuario** con **el menor coste arquitectónico razonable**.

---

# Roadmap de mejoras para la app de viajes (ATO)

## Enfoque: menos “tool runner”, más “agente que ayuda a decidir”

## Criterio de priorización

Voy a usar esta lógica:

* **P0** = mejora muy visible y de alto impacto; debería cambiar claramente la calidad del producto.
* **P1** = mejora importante que consolida la experiencia.
* **P2** = mejora valiosa, pero no crítica para la siguiente iteración.

Y en cada una te doy:

* **Qué mejora**
* **Por qué importa**
* **Impacto UX**
* **Impacto técnico**
* **Dónde tocar**
* **Riesgo**
* **Recomendación de implementación**

---

# P0 — Lo que más mejoraría el producto YA

---

# 1) Shortlist de vuelos en vez de catálogo bruto

## Prioridad: **P0**

## Impacto: **Muy alto**

## Coste: **Medio**

### Qué mejora

En vez de enseñar directamente decenas de resultados, el sistema debe **reducir primero el espacio de decisión** y presentar **3–5 vuelos candidatos**.

No es “ocultar resultados”; es **curarlos**.

---

### Por qué importa

Ahora mismo el mayor problema de producto parece ser este:

> el agente busca… pero luego le devuelve al usuario el problema entero.

Eso rompe la promesa del ATO.

El usuario no quiere:

* comparar 80 vuelos,
* leer horarios uno por uno,
* interpretar escalas, duración y precio.

Quiere:

* **2–5 opciones buenas**
* con sentido
* y con explicación.

---

### Impacto UX

Pasas de:

> “elige un vuelo entre un catálogo”

a:

> “te he reducido esto a las opciones que de verdad merecen atención”

Eso cambia completamente la sensación de inteligencia del producto.

---

### Impacto técnico

**No requiere rehacer la arquitectura.**
Se puede resolver como una capa nueva **entre `search_flights` y `pendingSelections`**.

---

### Dónde tocar

#### Backend / aplicación

* `src/contexts/travel/trip/application/graph/GraphExecutor.ts`
* mapper actual de `rankIfSearch`
* `src/contexts/travel/trip/application/decide/DecisionEngine.ts`

#### Posible nuevo módulo

* `src/contexts/travel/trip/application/flights/FlightOptionCurator.ts`

#### Frontend / workspace

* render de `pendingSelections`
* componente de catálogo de vuelos

---

### Qué implementaría exactamente

### Fase 1

Recibir `NormalizedFlightOffer[]` y hacer:

* deduplicación básica
* descarte de basura
* limitación inicial a top-N razonable
* agrupación por perfiles

### Buckets recomendados

Mostrar algo como:

* **Más barato**
* **Mejor equilibrio**
* **Más cómodo**
* **Más rápido**
* **Sin escalas** (si aplica)

No hace falta que siempre estén todos; solo los que tengan sentido.

---

### Shape conceptual útil

```ts
type CuratedFlightSelection = {
  totalFound: number;
  shortlist: NormalizedFlightOffer[];
  recommendationGroups: {
    cheapest?: string;
    balanced?: string;
    fastest?: string;
    mostComfortable?: string;
    nonstop?: string;
  };
};
```

---

### Riesgo

**Bajo–medio**.
El riesgo real no es técnico, sino **elegir mal la heurística inicial**. Pero eso es fácil de iterar.

---

### Recomendación

**Hacer esta mejora primero.**
Es probablemente la mejora con más ROI de toda la app.

---

# 2) Explicaciones legibles de por qué se recomienda cada vuelo

## Prioridad: **P0**

## Impacto: **Muy alto**

## Coste: **Bajo–medio**

### Qué mejora

Cada vuelo mostrado debería incluir una explicación breve del tipo:

* “Recomendado para ti”
* “Más barato, pero menos cómodo”
* “Mejor equilibrio entre precio y duración”
* “Evita escalas largas y llega en mejor horario”

---

### Por qué importa

Ahora mismo probablemente hay scoring, pero el usuario no “ve” el razonamiento.

Eso genera dos problemas:

* parece arbitrario
* obliga al usuario a reanalizarlo todo

Un agente bueno no solo recomienda: **justifica**.

---

### Impacto UX

Aumenta muchísimo la confianza.

El usuario empieza a sentir:

> “esto está pensado para mí”

en vez de:

> “me han ordenado una lista”.

---

### Impacto técnico

Muy asumible.
No hace falta meter LLM necesariamente.

Se puede construir con reglas sobre:

* precio relativo
* duración relativa
* escalas
* hora de salida / llegada
* cumplimiento de presupuesto

---

### Dónde tocar

#### Backend / aplicación

* `GraphExecutor.ts`
* mapper de ofertas → opciones de selección

#### Dominio / payload de selección

* `src/contexts/travel/trip/domain/GraphExecutionCheckpoint.ts`

#### Frontend

* componente de tarjeta de vuelo

---

### Qué implementaría

Añadir a cada opción algo como:

```ts
type FlightSelectionOption = {
  id: string;
  label: string;
  priceUsd?: number;
  rationale?: string;
  tags?: string[];
};
```

### Ejemplos de `rationale`

* “Es la mejor combinación de precio, duración y horario.”
* “Cuesta menos, pero incluye una escala.”
* “Es más caro, pero evita una conexión incómoda.”
* “Te permite llegar antes y aprovechar mejor el día.”

---

### Riesgo

**Muy bajo**.
Muy buena mejora para el coste que tiene.

---

### Recomendación

**Debe ir junto a la shortlist**.
Las dos mejoras se potencian muchísimo entre sí.

---

# 3) Rehacer el `comfortProxy` para que represente mejor el “coste humano” del vuelo

## Prioridad: **P0**

## Impacto: **Alto**

## Coste: **Medio**

### Qué mejora

El `comfortProxy` actual parece existir, pero seguramente está demasiado simplificado.

La mejora es que deje de ser una señal pobre y pase a reflejar mejor cosas como:

* número de escalas
* duración total
* layovers largos
* salidas absurdamente tempranas
* llegadas muy tarde
* vuelos nocturnos incómodos
* bonus por vuelo directo

---

### Por qué importa

Porque si el ranking no modela bien el “dolor real” de viajar, el sistema puede recomendar cosas que en papel parecen buenas, pero en experiencia humana son malas.

Y ahí el usuario deja de confiar.

---

### Impacto UX

Muy fuerte, aunque indirecto.

El usuario notará que:

* las recomendaciones “tienen sentido”
* no le salen arriba vuelos “trampa”
* el sistema entiende mejor el viaje real

---

### Impacto técnico

Moderado, pero bastante acotado.

No requiere cambiar el proveedor ni el planner.

---

### Dónde tocar

* `src/contexts/travel/trip/application/graph/GraphExecutor.ts`
* `src/contexts/travel/trip/application/decide/DecisionEngine.ts`

Posible helper nuevo:

* `src/contexts/travel/trip/application/flights/buildComfortProxy.ts`

---

### Qué implementaría

Construir `comfortProxy` en aplicación a partir de:

```ts
comfortProxy =
  base
  - penaltyForStops
  - penaltyForDuration
  - penaltyForBadDepartureTime
  - penaltyForLateArrival
  - penaltyForLongLayover
  + bonusForNonstop
```

Y mantenerlo en rango normalizado `0..1`.

---

### Recomendación

**No meter mucha “magia” al principio.**
Mejor una heurística clara y explicable que una pseudointeligencia opaca.

---

### Riesgo

**Bajo–medio**.
La única trampa es sobreajustarlo demasiado pronto.

---

# 4) Mejorar la UI de selección de vuelos para que sea “decisión” y no “listado”

## Prioridad: **P0**

## Impacto: **Muy alto**

## Coste: **Medio**

### Qué mejora

Hoy seguramente el catálogo de vuelos se muestra como una lista funcional.
La mejora es presentarlo como **momento de decisión guiada**.

---

### Por qué importa

Porque este es el momento más importante del producto.
Si aquí la UX parece una tabla o una lista plana, se pierde muchísimo valor.

---

### Impacto UX

Muy alto.

El usuario debería sentir:

> “estoy tomando una decisión asistida”

no:

> “me han devuelto resultados”.

---

### Dónde tocar

Frontend del workspace, especialmente donde renderiza:

* `phase: awaiting_selection`
* `pendingSelections`
* `selectionKind: "flight"`

---

### Qué implementaría

Cada tarjeta debería mostrar, de forma clara:

* precio
* salida / llegada
* duración
* escalas
* badge tipo:

  * “Recomendado”
  * “Más barato”
  * “Más cómodo”
* mini explicación
* CTA claro: **Elegir este vuelo**

Y encima del bloque algo como:

> “He encontrado 84 opciones. Estas son las 4 que mejor encajan contigo.”

Eso ya cambia muchísimo la percepción.

---

### Riesgo

**Bajo**.
Esto es UX / presentación con backend razonablemente compatible.

---

### Recomendación

Hacerlo junto a la shortlist.
No tiene sentido mejorar la shortlist y dejar una UI de selección plana.

---

# P1 — Lo siguiente que haría tras arreglar la parte crítica

---

# 5) Refinamiento de búsqueda desde la selección (sin replantear todo el viaje)

## Prioridad: **P1**

## Impacto: **Muy alto**

## Coste: **Medio–alto**

### Qué mejora

Permitir que el usuario no solo “elija uno”, sino también afine:

* “quiero algo más barato”
* “solo directos”
* “quiero llegar antes”
* “nada que salga antes de las 8”
* “enséñame más opciones parecidas a esta”

---

### Por qué importa

Ahora mismo el flujo parece binario:

* o eliges
* o no avanzas

Eso es demasiado rígido.

Un agente bueno permite **negociar la decisión**.

---

### Impacto UX

Muy alto.
Hace que el producto se sienta mucho más “vivo” y menos “wizard con botones”.

---

### Impacto técnico

Moderado–alto, pero muy interesante.

No requiere rehacer el planner si lo modeláis bien.

---

### Dónde tocar

#### Backend

* `GraphExecutor.ts`
* `POST /api/graph/select` o endpoint complementario
* posible nueva semántica de refinamiento

#### Dominio

* `GraphExecutionCheckpoint.ts`
* `SelectionOptionPayload`
* posible `selection_refinement`

#### Frontend

* UI de refinamiento dentro del catálogo

---

### Recomendación de diseño

**No lo haría como “nuevo plan completo”.**

Lo modelaría como una **refinación local del `selection_request`**.

Eso es mucho más limpio conceptualmente.

---

### Riesgo

**Medio**.
Hay que cuidar bien que no rompa el estado de ejecución.

---

### Recomendación

Muy buena mejora para la **segunda iteración**.

---

# 6) Recuperación de búsqueda de vuelos más inteligente

## Prioridad: **P1**

## Impacto: **Alto**

## Coste: **Medio**

### Qué mejora

Cuando no hay resultados o falla el provider, el sistema no debería solo pedir datos faltantes.

También debería proponer **estrategias de salida**.

---

### Por qué importa

Porque un “no hay vuelos” sin propuesta de recuperación se siente como fallo del producto.

En cambio, si el agente responde con alternativas, se siente útil.

---

### Ejemplos de estrategias de recuperación

* probar un día antes
* probar un día después
* ampliar aeropuertos cercanos
* permitir una escala
* relajar presupuesto
* cambiar franja horaria

---

### Impacto UX

Muy fuerte.

Convierte el fallo en conversación útil.

---

### Dónde tocar

* `FlightRecoveryPort`
* orquestación tras `flight_tool_failed` / `no_flight_offers`
* UI de `awaiting_input`

---

### Qué implementaría

En vez de solo devolver slots, permitir algo como:

```ts
type FlightRecoverySuggestion = {
  kind: "shift_date" | "allow_stops" | "expand_airports";
  label: string;
  patch: Record<string, unknown>;
};
```

Y que el usuario pueda elegir una de esas estrategias.

---

### Riesgo

**Bajo–medio**.
Bastante buen retorno.

---

### Recomendación

Muy buena mejora P1.
Tiene bastante valor de producto real.

---

# 7) Captura progresiva de preferencias de vuelo (antes o durante la búsqueda)

## Prioridad: **P1**

## Impacto: **Alto**

## Coste: **Medio**

### Qué mejora

Ahora el sistema parece pedir lo mínimo obligatorio.
La mejora es pedir **preferencias útiles de forma progresiva**, no en un formulario gigante.

---

### Por qué importa

Porque una búsqueda buena depende mucho de cosas que hoy seguramente no se capturan.

---

### Qué preferencias son más valiosas

* ¿aceptas escalas?
* ¿te importa mucho la hora de salida?
* ¿prefieres llegar pronto o pagar menos?
* ¿viaje de ocio o de trabajo?
* ¿solo aeropuerto principal o cualquiera cercano?

---

### Cómo debería comportarse

No preguntar todo siempre.

Solo preguntar cuando **mejora claramente la calidad de la búsqueda o la recomendación**.

Ejemplo:

> “Antes de buscar: ¿prefieres priorizar directos o lo más barato?”

---

### Dónde tocar

* planner prompts
* `GenerateTravelPlan`
* `need_input`
* `missingSlots`
* `gatheredSlots`
* UI de formularios / continuación

---

### Riesgo

**Medio**.
La dificultad está en no sobrecargar al usuario.

---

### Recomendación

Buena mejora, pero **después de arreglar la shortlist**.

---

# 8) Hacer visible el estado del plan / grafo al usuario

## Prioridad: **P1**

## Impacto: **Medio–alto**

## Coste: **Bajo–medio**

### Qué mejora

Mostrar claramente en la UI en qué punto del viaje está el agente.

---

### Por qué importa

Ahora mismo el sistema tiene un modelo interno muy bueno:

* plan
* dependencias
* simulación
* pasos
* bloqueo vuelo → hotel
* reanudación

Pero si el usuario no lo ve, esa inteligencia se desperdicia.

---

### Impacto UX

Reduce mucho la confusión.

El usuario entiende:

* qué se ha hecho
* qué falta
* por qué está esperando

---

### Qué implementaría

Algo tipo checklist / timeline:

* ✅ Entender objetivo
* ✅ Completar datos
* ✅ Buscar vuelos
* ⏳ Elegir vuelo
* 🔒 Buscar hotel
* 🔒 Elegir hotel
* 🔒 Confirmar itinerario

---

### Dónde tocar

Frontend del workspace, usando:

* `plan`
* `executedSteps`
* `pendingSelections`
* `summary`
* `auditEvents`

---

### Riesgo

**Muy bajo**.

---

### Recomendación

Muy buena mejora “barata” para percepción de producto.

---

# P2 — Mejoras con bastante valor, pero no urgentes

---

# 9) Mejorar la selección de hoteles con la misma filosofía que vuelos

## Prioridad: **P2**

## Impacto: **Alto**

## Coste: **Medio**

### Qué mejora

Aplicar la misma lógica de:

* shortlist
* explicación
* mejores categorías
* menos ruido

a hoteles.

---

### Por qué importa

El problema cognitivo es parecido, aunque menos crítico que vuelos.

---

### Recomendación

**No lo haría antes de arreglar vuelos.**
Primero una vertical bien resuelta.

---

# 10) Itinerarios compuestos (vuelo + hotel como recomendación integrada)

## Prioridad: **P2**

## Impacto: **Muy alto**

## Coste: **Alto**

### Qué mejora

En vez de decidir por piezas, el sistema podría proponer combinaciones:

* opción más barata
* opción más cómoda
* mejor equilibrio

---

### Por qué importa

Esto os acerca mucho más a un “agente de viajes” real.

---

### Riesgo

Alto, porque ya toca más lógica de dependencia y composición.

---

### Recomendación

Muy buena visión futura, **pero no para el siguiente sprint**.

---

# 11) Memoria de preferencias por sesión / perfil de viajero

## Prioridad: **P2**

## Impacto: **Medio–alto**

## Coste: **Medio**

### Qué mejora

Si el usuario suele preferir:

* directos
* vuelos tarde
* hoteles céntricos
* presupuesto ajustado

el sistema debería reutilizar eso.

---

### Por qué importa

Hace que el agente parezca “aprender”.

---

### Dónde tocar

* sesión / Postgres
* `preferences`
* prompts / defaults de decisión

---

### Recomendación

Interesante, pero después de tener buena lógica base.

---

# Roadmap recomendado por iteraciones reales

Ahora te lo aterrizo como **plan de ejecución práctico**.

---

# Iteración 1 — “Que elegir vuelo deje de ser un dolor”

## Objetivo

Que el producto se sienta claramente mejor **sin tocar demasiado el core**.

## Incluye

### P0.1

**Shortlist de vuelos**

### P0.2

**Explicaciones por opción**

### P0.3

**Mejor `comfortProxy`**

### P0.4

**UI de selección más guiada**

---

## Resultado esperado

El usuario deja de ver “muchos vuelos” y empieza a ver:

> “unas pocas opciones buenas, con lógica”

Esto por sí solo ya puede cambiar mucho la percepción del producto.

---

# Iteración 2 — “Que el agente pueda negociar la decisión”

## Objetivo

Que el sistema no solo muestre opciones, sino que **permita afinar**.

## Incluye

### P1.1

**Refinamiento de selección**

### P1.2

**Recuperación inteligente de vuelos**

### P1.3

**Preferencias progresivas de vuelo**

---

## Resultado esperado

El producto deja de sentirse rígido y empieza a sentirse **colaborativo**.

---

# Iteración 3 — “Que el usuario entienda mejor qué está haciendo el agente”

## Objetivo

Dar más claridad y percepción de control.

## Incluye

### P1.4

**Timeline / estado del plan**

### P2.1

**Mejorar hoteles con la misma filosofía**

---

# Iteración 4 — “Diferenciación fuerte”

## Objetivo

Acercaros a un agente de viajes más potente de verdad.

## Incluye

### P2.2

**Itinerarios compuestos**

### P2.3

**Memoria de preferencias**

---

# Mi recomendación más honesta de producto

Si me pidieras escoger **solo una línea de trabajo** para la próxima iteración, te diría sin dudar:

# Enfócate en la experiencia de decisión de vuelos

Porque hoy mismo eso parece ser el mayor gap entre:

* **una arquitectura bastante buena**
* y **una experiencia que todavía no está al nivel de esa arquitectura**

Dicho de forma muy directa:

## vuestro backend ya parece más “agente” que vuestra UX actual

Y eso es una buena noticia, porque significa que **hay bastante valor atrapado que podéis sacar sin rehacer todo**.

---

# Qué haría yo primero, exactamente

## Sprint recomendado (el más sensato)

### 1.

Crear shortlist de vuelos

### 2.

Añadir explicación / rationale por opción

### 3.

Mejorar `comfortProxy`

### 4.

Actualizar UI de selección

---

## Si hacéis solo eso, ya tendríais una mejora muy seria del producto.

---

Si quieres, el siguiente paso útil de verdad es este:

## te convierto este roadmap en un **plan de implementación para Cursor**

mucho más operativo, tipo:

* **tarea**
* **archivos a tocar**
* **orden recomendado**
* **qué no romper**
* **criterio de aceptación**
* **prompt listo para que Cursor implemente la Iteración 1**

Y te lo preparo directamente centrado en:

# **“mejora de selección de vuelos”**

que es donde más retorno vais a sacar.
