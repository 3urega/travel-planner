"use client";

import * as React from "react";
import { motion } from "framer-motion";

import { Badge } from "@/components/ui/badge";
import type { ATOResponse } from "@/contexts/travel/trip/domain/ATOResponse";
import type { WorkspaceStage } from "../workflow/types";

function heroCopy(
  response: ATOResponse | null,
  stage: WorkspaceStage,
): {
  title: string;
  subtitle: string;
  badge: string;
} {
  if (stage === "define_trip") {
    if (response?.phase === "blocked") {
      return {
        title: "Hay que ajustar el tramo aéreo",
        subtitle:
          response.assistantMessage ??
          response.flightSearchBlock?.reason ??
          "Revisa origen, destino y fechas; no se mostró catálogo de hoteles hasta tener vuelos.",
        badge: "Vuelos",
      };
    }
    if (!response || response.phase === "awaiting_input") {
      return {
        title: "Empecemos por el viaje que imaginas",
        subtitle:
          response?.phase === "awaiting_input"
            ? (response.assistantMessage ??
              "Solo un poco de contexto y tejemos opciones a tu medida.")
            : "Sin prisas de formulario: cuéntanos ruta, fechas y tono. El sistema te acompañará paso a paso.",
        badge: "Definición",
      };
    }
  }

  if (stage === "select_flight") {
    const sel = response?.pendingSelections?.[0];
    return {
      title: sel?.title ?? "Las mejores formas de llegar",
      subtitle:
        "Pocas opciones, bien curadas. Elige con claridad; el resto del itinerario se alinea a tu vuelo.",
      badge: "Vuelo",
    };
  }

  if (stage === "select_hotel") {
    const sel = response?.pendingSelections?.[0];
    return {
      title: sel?.title ?? "¿Dónde te gustaría descansar?",
      subtitle:
        "Estancias alineadas con tu tramo aéreo y tu objetivo de viaje. Un clic y el plan cobra forma coherente.",
      badge: "Estancia",
    };
  }

  if (stage === "review_trip") {
    return {
      title: "Esto es lo que tu viaje significa en números y ritmo",
      subtitle:
        response?.summary ??
        response?.simulation.humanSummary ??
        "Revisa costes, matices y tradeoffs antes de dar el siguiente paso.",
      badge: "Revisión",
    };
  }

  if (stage === "approve") {
    return {
      title: "Todo converge: solo falta tu visto bueno sereno",
      subtitle:
        "Políticas y límites explícitos. Sin presión de checkout; solo transparencia antes de que el sistema actúe.",
      badge: "Aprobación",
    };
  }

  if (stage === "execute_ready") {
    return {
      title: "El operador está en posición",
      subtitle:
        response?.summary ??
        "Pasos ejecutados, auditoría y grafos: visibilidad de lo que ya ocurrió y lo que puede seguir.",
      badge: "Operación",
    };
  }

  return {
    title: "Diseñemos un viaje que se sienta tuyo",
    subtitle:
      "Cuéntanos el tono del viaje: fechas, ritmo y lo que no negocias.",
    badge: "Inicio",
  };
}

const easeLux = [0.22, 1, 0.36, 1] as const;

export function WorkspaceHero({
  response,
  stage,
}: {
  response: ATOResponse | null;
  stage: WorkspaceStage;
}): React.ReactElement {
  const { title, subtitle, badge } = heroCopy(response, stage);
  const showTurn =
    stage === "select_flight" || stage === "select_hotel";

  return (
    <motion.section
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: easeLux }}
      className="ato-noise ato-glass relative overflow-hidden rounded-2xl"
    >
      <div
        className="pointer-events-none absolute -right-20 top-0 h-72 w-72 rounded-full opacity-45 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, color-mix(in srgb, var(--primary) 10%, transparent), transparent 68%)",
        }}
      />
      <div className="relative px-6 py-8 md:px-10 md:py-10">
        <motion.div
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.08, duration: 0.45, ease: easeLux }}
          className="mb-5 flex flex-wrap items-center gap-3"
        >
          <span className="ato-kicker">{badge}</span>
          <Badge variant="luxury">Mesa de decisiones</Badge>
          {showTurn && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.35 }}
              className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary"
            >
              Tu turno
            </motion.span>
          )}
        </motion.div>

        <motion.h2
          layout
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.06, duration: 0.55, ease: easeLux }}
          className="font-ato-display max-w-[22ch] text-3xl font-medium leading-[1.12] tracking-[-0.02em] text-foreground md:text-[2.35rem] lg:text-[2.65rem]"
        >
          {title}
        </motion.h2>

        <motion.p
          layout
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.18, duration: 0.5 }}
          className="mt-5 max-w-2xl text-base leading-[1.65] text-muted-foreground md:text-[1.05rem]"
        >
          {subtitle}
        </motion.p>
      </div>
    </motion.section>
  );
}
