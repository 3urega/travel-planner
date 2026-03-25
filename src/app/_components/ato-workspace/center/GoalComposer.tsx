"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { ATOResponse } from "@/contexts/travel/trip/domain/ATOResponse";
import type { PlannerMissingSlot } from "@/contexts/travel/trip/domain/PlannerResult";
import type { WorkspaceStatus } from "../hooks/useWorkspaceAgent";

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
    <Card className="border-zinc-800/80">
      <CardContent className="space-y-4 p-5">
        {!awaitingInput && (
          <>
            <Label htmlFor="ato-goal" className="text-zinc-300">
              Objetivo del viaje
            </Label>
            <textarea
              id="ato-goal"
              value={goalMessage}
              onChange={(e) => onGoalChange(e.target.value)}
              disabled={loading}
              rows={4}
              placeholder='Ej.: "Barcelona a París en Navidad, 4 días, presupuesto medio"'
              className="w-full resize-none rounded-lg border border-zinc-700 bg-zinc-950/60 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/50 disabled:opacity-50"
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="primary"
                type="button"
                disabled={loading || !goalMessage.trim()}
                onClick={() => void onSubmit()}
              >
                <Sparkles className="size-4" />
                Ejecutar planificador
              </Button>
              {loading && (
                <div className="flex flex-1 flex-col gap-2 min-w-[120px] max-w-xs">
                  <Skeleton className="h-2 w-full" />
                  <Skeleton className="h-2 w-4/5" />
                </div>
              )}
            </div>
          </>
        )}

        {awaitingInput && slots.length > 0 && (
          <div className="space-y-4 border-t border-zinc-800 pt-4">
            <p className="text-sm text-zinc-300">
              {response?.assistantMessage}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {slots.map((slot: PlannerMissingSlot) => (
                <div key={slot.id}>
                  <Label htmlFor={`slot-${slot.id}`}>{slot.label}</Label>
                  {slot.role === "destination" ? (
                    <Input
                      id={`slot-${slot.id}`}
                      className="mt-1"
                      value={slotDraft[slot.id] ?? ""}
                      onChange={(e) =>
                        onSlotChange(slot.id, e.target.value)
                      }
                      placeholder="Ciudad o destino"
                    />
                  ) : (
                    <Input
                      id={`slot-${slot.id}`}
                      type="date"
                      className="mt-1 font-mono"
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
              variant="primary"
              type="button"
              disabled={loading || !canContinueSlots}
              onClick={() => void onContinueSlots()}
            >
              Continuar con el plan
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
