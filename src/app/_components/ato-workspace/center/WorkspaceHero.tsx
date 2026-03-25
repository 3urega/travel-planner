"use client";

import * as React from "react";
import { motion } from "framer-motion";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ATOResponse } from "@/contexts/travel/trip/domain/ATOResponse";

function heroCopy(response: ATOResponse | null): {
  title: string;
  subtitle: string;
  badge: string;
} {
  if (!response) {
    return {
      title: "Operador de viajes autónomo",
      subtitle:
        "Describe tu objetivo abajo. El sistema planificará, simulará y se detendrá cuando debas elegir vuelo u hotel.",
      badge: "Inicio",
    };
  }
  if (response.phase === "awaiting_input") {
    return {
      title: "Necesitamos un poco más de contexto",
      subtitle:
        response.assistantMessage ??
        "Completa los datos para generar un plan ejecutable.",
      badge: "Planificación",
    };
  }
  if (response.phase === "awaiting_selection") {
    const sel = response.pendingSelections?.[0];
    return {
      title: sel?.title ?? "Tu decisión",
      subtitle:
        "Hemos acotado opciones con scoring de precio y confort. Elige la que encaje mejor; el grafo continuará automáticamente.",
      badge: "Esperando elección",
    };
  }
  return {
    title: "Itinerario procesado",
    subtitle: response.summary,
    badge:
      response.pendingApprovals.length > 0 ? "Aprobaciones" : "Listo",
  };
}

export function WorkspaceHero({
  response,
}: {
  response: ATOResponse | null;
}): React.ReactElement {
  const { title, subtitle, badge } = heroCopy(response);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card className="relative overflow-hidden border-emerald-900/40 bg-gradient-to-br from-zinc-900/90 via-zinc-900/50 to-emerald-950/25">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(16,185,129,0.12),transparent_55%)]" />
        <CardContent className="relative p-6 lg:p-8">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Badge variant="accent">{badge}</Badge>
            {response?.phase === "awaiting_selection" && (
              <span className="text-xs font-medium uppercase tracking-wider text-amber-200/90">
                Tu turno
              </span>
            )}
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-50 lg:text-3xl">
            {title}
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-relaxed text-zinc-400 lg:text-base">
            {subtitle}
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
