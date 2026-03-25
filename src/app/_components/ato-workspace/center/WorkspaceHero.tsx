"use client";

import * as React from "react";
import { motion } from "framer-motion";

import { Badge } from "@/components/ui/badge";
import type { ATOResponse } from "@/contexts/travel/trip/domain/ATOResponse";

function heroCopy(response: ATOResponse | null): {
  title: string;
  subtitle: string;
  badge: string;
} {
  if (!response) {
    return {
      title: "Diseñemos un viaje que se sienta tuyo",
      subtitle:
        "Cuéntanos el tono del viaje: fechas, ritmo y lo que no negocias. El sistema te devolverá un plan vivo — y se detendrá en los cruces donde tú debes decidir.",
      badge: "Próximo paso",
    };
  }
  if (response.phase === "awaiting_input") {
    return {
      title: "Antes de volar, completemos el retrato",
      subtitle:
        response.assistantMessage ??
        "Un par de datos más y el itinerario cobrará forma concreta.",
      badge: "Con tu voz",
    };
  }
  if (response.phase === "awaiting_selection") {
    const sel = response.pendingSelections?.[0];
    return {
      title: sel?.title ?? "Un momento para elegir con calma",
      subtitle:
        "Hemos curado pocas opciones, cada una con su equilibrio precio–confort. Tu elección reanuda el hilo del plan como si cerraras un capítulo.",
      badge: "Decisión",
    };
  }
  return {
    title: "El itinerario ya respira en una sola línea",
    subtitle: response.summary,
    badge:
      response.pendingApprovals.length > 0 ? "Revisión" : "Listo para avanzar",
  };
}

const easeLux = [0.22, 1, 0.36, 1] as const;

export function WorkspaceHero({
  response,
}: {
  response: ATOResponse | null;
}): React.ReactElement {
  const { title, subtitle, badge } = heroCopy(response);

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
          {response?.phase === "awaiting_selection" && (
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
