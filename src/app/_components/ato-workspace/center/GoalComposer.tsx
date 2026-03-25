"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { PenLine } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { ATOResponse } from "@/contexts/travel/trip/domain/ATOResponse";
import type { PlannerMissingSlot } from "@/contexts/travel/trip/domain/PlannerResult";
import type { WorkspaceStatus } from "../hooks/useWorkspaceAgent";

const TRIP_PROMPTS: { label: string; text: string }[] = [
  {
    label: "Ciudad + fechas",
    text: "Fin de semana largo en Barcelona saliendo desde Madrid, priorizando buen vuelo matutino.",
  },
  {
    label: "Presupuesto medio",
    text: "Una semana en el norte de Italia en primavera, presupuesto medio, sin comer fuera cada noche.",
  },
  {
    label: "Trabajo + calma",
    text: "Combinar dos días de reuniones en Frankfurt con dos noches de desconexión cerca del campo.",
  },
];

export function GoalComposer({
  goalMessage,
  onGoalChange,
  onSubmit,
  status,
  response,
  slotDraft,
  onSlotChange,
  onContinueSlots,
}: {
  goalMessage: string;
  onGoalChange: (v: string) => void;
  onSubmit: () => void;
  status: WorkspaceStatus;
  response: ATOResponse | null;
  slotDraft: Record<string, string>;
  onSlotChange: (id: string, v: string) => void;
  onContinueSlots: () => void;
}): React.ReactElement {
  const loading = status === "loading";
  const awaitingInput = response?.phase === "awaiting_input";
  const slots = response?.missingSlots ?? [];

  const canContinueSlots =
    awaitingInput &&
    slots.length > 0 &&
    slots.every((s) => slotDraft[s.id]?.trim());

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
      className="ato-noise ato-glass relative overflow-hidden rounded-2xl"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      <CardContent className="space-y-5 p-6 md:p-8">
        <div className="flex items-start gap-3">
          <span className="mt-1 rounded-full border border-border bg-accent p-2 text-primary">
            <PenLine className="size-4" strokeWidth={1.5} />
          </span>
          <div>
            <p className="ato-kicker mb-1">Briefing del viaje</p>
            <p className="font-ato-display text-xl font-medium text-foreground">
              Escribe como si se lo contaras a un concierge de confianza
            </p>
          </div>
        </div>

        {!awaitingInput && (
          <>
            <Label htmlFor="ato-goal" className="sr-only">
              Objetivo del viaje
            </Label>
            <textarea
              id="ato-goal"
              value={goalMessage}
              onChange={(e) => onGoalChange(e.target.value)}
              disabled={loading}
              rows={4}
              placeholder='Ej.: “Cuatro noches entre luces y calma en Lisboa, sin madrugadas imposibles.”'
              className="w-full resize-none rounded-xl border border-input-border bg-input px-5 py-4 text-[0.95rem] leading-relaxed text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50"
            />
            <div className="flex flex-wrap gap-2">
              <p className="w-full text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                Ideas rápidas
              </p>
              {TRIP_PROMPTS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  disabled={loading}
                  onClick={() => onGoalChange(p.text)}
                  className="rounded-full border border-border bg-card px-3 py-1.5 text-left text-xs text-foreground transition-colors hover:border-primary-border hover:bg-primary-subtle disabled:opacity-50"
                >
                  <span className="font-medium text-primary">{p.label}</span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground line-clamp-2">
                    {p.text}
                  </span>
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <Button
                variant="cta"
                type="button"
                disabled={loading || !goalMessage.trim()}
                onClick={() => void onSubmit()}
                className="rounded-xl px-6 font-semibold tracking-wide"
              >
                Planificar mi itinerario
              </Button>
              {loading && (
                <div className="flex flex-1 flex-col gap-2 min-w-[140px] max-w-xs">
                  <Skeleton className="h-2 w-full rounded-full" />
                  <Skeleton className="h-2 w-4/5 rounded-full" />
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    Curando rutas y tono
                  </p>
                </div>
              )}
            </div>
          </>
        )}

        {awaitingInput && slots.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-5 border-t border-border pt-6"
          >
            <p className="text-sm leading-relaxed text-foreground/90">
              {response?.assistantMessage}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {slots.map((slot: PlannerMissingSlot) => (
                <div key={slot.id}>
                  <Label
                    htmlFor={`slot-${slot.id}`}
                    className="text-xs uppercase tracking-wider"
                  >
                    {slot.label}
                  </Label>
                  {slot.role === "destination" ? (
                    <Input
                      id={`slot-${slot.id}`}
                      className="mt-2 rounded-lg"
                      value={slotDraft[slot.id] ?? ""}
                      onChange={(e) =>
                        onSlotChange(slot.id, e.target.value)
                      }
                      placeholder="Ciudad destino"
                    />
                  ) : (
                    <Input
                      id={`slot-${slot.id}`}
                      type="date"
                      className="mt-2 rounded-lg font-mono text-sm"
                      value={slotDraft[slot.id] ?? ""}
                      onChange={(e) =>
                        onSlotChange(slot.id, e.target.value)
                      }
                    />
                  )}
                </div>
              ))}
            </div>
            <Button
              variant="cta"
              type="button"
              disabled={loading || !canContinueSlots}
              onClick={() => void onContinueSlots()}
              className="rounded-xl font-semibold"
            >
              Continuar el relato del viaje
            </Button>
          </motion.div>
        )}
      </CardContent>
    </motion.div>
  );
}
