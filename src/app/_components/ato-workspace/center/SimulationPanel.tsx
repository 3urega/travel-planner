"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";

import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { SimulationResult } from "@/contexts/travel/trip/domain/SimulationResult";
import { cn } from "@/lib/utils";

export function SimulationPanel({
  simulation,
  compact,
}: {
  simulation: SimulationResult | null;
  compact?: boolean;
}): React.ReactElement {
  if (!simulation) {
    return (
      <div className="ato-noise ato-glass-elevated rounded-2xl">
        <CardHeader className="md:px-8">
          <span className="ato-kicker mb-2">Sensación del recorrido</span>
          <CardTitle className="font-ato-display normal-case tracking-normal text-xl text-foreground">
            Simulación aún en pausa
          </CardTitle>
        </CardHeader>
        <CardContent className="md:px-8 md:pb-8">
          <p className="text-sm leading-relaxed text-muted-foreground">
            En cuanto el plan respire con fechas y tramos, aquí verás si el ritmo
            encaja con tu cuerpo y tu presupuesto — como una carta clara, no como
            un informe denso.
          </p>
        </CardContent>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="ato-noise ato-glass-elevated relative overflow-hidden rounded-2xl"
    >
      <div
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 w-0.5",
          simulation.feasible
            ? "bg-[color-mix(in_srgb,var(--success)_55%,var(--border))]"
            : "bg-[color-mix(in_srgb,var(--warning)_50%,var(--border))]",
        )}
      />
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 md:px-8">
        <div className="flex items-start gap-3">
          <span className="mt-1 rounded-full border border-border bg-accent p-2 text-primary">
            <Sparkles className="size-4" strokeWidth={1.5} />
          </span>
          <div>
            <span className="ato-kicker mb-1 block">Lectura del itinerario</span>
            <CardTitle className="font-ato-display normal-case tracking-normal text-xl text-foreground md:text-2xl">
              {simulation.feasible
                ? "El viaje encaja en una sola respiración"
                : "Hay fricción — la podemos suavizar"}
            </CardTitle>
          </div>
        </div>
        <Badge
          variant={simulation.feasible ? "success" : "warning"}
          className="shrink-0"
        >
          {simulation.feasible ? "Armonía" : "Atención"}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-6 md:px-8 md:pb-8">
        <blockquote className="border-none pl-0 font-ato-display text-lg font-normal leading-[1.55] text-foreground/95 md:text-[1.15rem]">
          “{simulation.humanSummary}”
        </blockquote>
        {!compact && simulation.breakdown.length > 0 && (
          <div className="space-y-2 rounded-xl border border-border bg-card px-4 py-4 shadow-[var(--shadow-soft)]">
            {simulation.breakdown.map((b) => (
              <div
                key={b.stepId}
                className="flex justify-between gap-4 text-sm text-muted-foreground"
              >
                <span className="text-foreground/85">{b.description}</span>
                <span className="shrink-0 tabular-nums font-medium text-foreground">
                  ${b.estimatedCost}
                </span>
              </div>
            ))}
            <div className="flex justify-between border-t border-border pt-3 text-sm font-semibold text-foreground">
              <span>Estimación conjunta</span>
              <span className="tabular-nums font-semibold text-primary">
                ${simulation.totalEstimatedCost}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </motion.div>
  );
}
