"use client";

import * as React from "react";
import { motion } from "framer-motion";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      <Card className="border-zinc-800/60">
        <CardHeader>
          <CardTitle>Simulación</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-zinc-500">
            La simulación aparecerá cuando el plan esté generado.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.1, duration: 0.35 }}
    >
      <Card
        className={cn(
          "border-zinc-800/80",
          simulation.feasible ? "border-l-2 border-l-emerald-600/80" : "border-l-2 border-l-red-600/60",
        )}
      >
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle>Inteligencia del itinerario</CardTitle>
          <Badge variant={simulation.feasible ? "success" : "warning"}>
            {simulation.feasible ? "Factible" : "Con conflictos"}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm leading-relaxed text-zinc-300">
            {simulation.humanSummary}
          </p>
          {!compact && simulation.breakdown.length > 0 && (
            <div className="space-y-2 rounded-lg bg-zinc-950/50 p-3">
              {simulation.breakdown.map((b) => (
                <div
                  key={b.stepId}
                  className="flex justify-between text-xs text-zinc-400"
                >
                  <span>{b.description}</span>
                  <span className="tabular-nums font-medium text-zinc-200">
                    ${b.estimatedCost}
                  </span>
                </div>
              ))}
              <div className="flex justify-between border-t border-zinc-800 pt-2 text-sm font-semibold text-zinc-100">
                <span>Total estimado</span>
                <span className="tabular-nums">
                  ${simulation.totalEstimatedCost}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
