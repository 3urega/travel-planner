🧠 Concepto general

Este sistema no es un chatbot.
Es un agente autónomo orientado a objetivos que puede:

entender una intención compleja
descomponerla en pasos
usar herramientas externas
tomar decisiones intermedias
ejecutar acciones (con control)

La interfaz es conversacional, pero el núcleo es un sistema de planificación + ejecución.

🎯 Objetivo del sistema

Convertir una instrucción de alto nivel:

“Organiza un viaje a Japón de 10 días con presupuesto medio”

En:

un plan estructurado
decisiones justificadas
acciones ejecutables (o simuladas)
🧩 Componentes conceptuales
1. Intention parsing

Transforma input humano en:

objetivos
restricciones
preferencias
2. Planning (core del agente)

El sistema:

divide el problema en subtareas
decide orden de ejecución
replanifica si algo falla
3. Tool usage

El agente no “sabe todo”:

delega en tools externas
interpreta resultados
toma decisiones basadas en esos datos
4. State / Memory

Debe mantener:

contexto del viaje
decisiones previas
opciones evaluadas
5. 🔐 Auth Layer (crítico)

El agente NO tiene autoridad total.

Debe:

identificar acciones sensibles (pagos, reservas)
pausar ejecución
solicitar aprobación explícita
registrar decisiones

👉 Esto convierte el sistema en seguro y confiable

⚖️ Principios clave
el agente propone, no impone
las acciones críticas requieren confirmación
el sistema debe ser explicable
cada decisión debe poder auditarse
🚨 Qué NO es este proyecto
no es un chatbot tipo FAQ
no es solo generación de texto
no es un wrapper de API
🧭 Qué lo hace valioso
combina reasoning + acción
introduce control humano en IA autónoma
simula un caso real de negocio