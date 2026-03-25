"use client";

import * as React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import type { ATOResponse } from "@/contexts/travel/trip/domain/ATOResponse";
import type { StageRow } from "../adapters";

function StageDot({ state }: { state: StageRow["state"] }): React.ReactElement {
  const styles = {
    locked: "bg-zinc-800 border-zinc-700",
    waiting: "bg-amber-500/30 border-amber-500/70 ring-2 ring-amber-500/40",
    active: "bg-emerald-500/25 border-emerald-500/70 ring-2 ring-emerald-500/30",
    completed: "bg-emerald-600/40 border-emerald-600",
  } as const;
  return (
    <span
      className={cn(
        "inline-flex h-2.5 w-2.5 shrink-0 rounded-full border",
        styles[state],
      )}
    />
  );
}

export function TripContextSidebar({
  response,
  stages,
  priceComfortSlider,
  onPriceComfortChange,
  maxPriceUsd,
  onMaxPriceChange,
}: {
  response: ATOResponse | null;
  stages: StageRow[];
  priceComfortSlider: number;
  onPriceComfortChange: (v: number) => void;
  maxPriceUsd: string;
  onMaxPriceChange: (v: string) => void;
}): React.ReactElement {
  const goal = response?.plan.goal ?? "Describe tu viaje en el panel central.";

  return (
    <div className="flex flex-col gap-4">
      <Card className="border-zinc-800/80">
        <CardHeader>
          <CardTitle>Contexto del viaje</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-zinc-300">
          <p className="leading-relaxed text-zinc-200">{goal}</p>
        </CardContent>
      </Card>

      <Card className="border-zinc-800/80">
        <CardHeader>
          <CardTitle>Preferencias</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="mb-2 block">Presupuesto máx. (USD)</Label>
            <Input
              type="number"
              min={0}
              step={50}
              placeholder="ej. 800"
              value={maxPriceUsd}
              onChange={(e) => onMaxPriceChange(e.target.value)}
            />
          </div>
          <div>
            <div className="mb-2 flex justify-between text-xs text-zinc-500">
              <span>Priorizar precio</span>
              <span>Priorizar confort</span>
            </div>
            <Slider
              value={[priceComfortSlider]}
              min={0}
              max={100}
              step={1}
              onValueChange={(v) => onPriceComfortChange(v[0] ?? 40)}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-zinc-800/80">
        <CardHeader>
          <CardTitle>Etapas</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {stages.map((s) => (
              <li key={s.id} className="flex items-center gap-3 text-sm">
                <StageDot state={s.state} />
                <span
                  className={cn(
                    s.state === "locked" && "text-zinc-600",
                    s.state === "waiting" && "font-medium text-amber-200",
                    s.state === "active" && "font-medium text-emerald-200",
                    s.state === "completed" && "text-zinc-300",
                  )}
                >
                  {s.label}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card className="border-zinc-800/80">
        <CardHeader>
          <CardTitle>Versiones</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-zinc-500">
          <p className="font-mono text-zinc-400">
            {response?.adgGraphVersionId
              ? `ADG v · ${response.adgGraphVersionId.slice(0, 8)}…`
              : "Sin grafo persistido aún."}
          </p>
          <p className="mt-2 text-zinc-600">
            Ramificación multi-graph prevista; esta sesión usa una versión
            activa.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
