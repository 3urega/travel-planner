"use client";

import * as React from "react";
import { motion } from "framer-motion";

import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import type { ATOResponse } from "@/contexts/travel/trip/domain/ATOResponse";
import type { StageRow } from "../adapters";

function StageDot({ state }: { state: StageRow["state"] }): React.ReactElement {
  const styles = {
    locked: "bg-muted border-border",
    waiting:
      "border-warning bg-warning-subtle ring-2 ring-[color-mix(in_srgb,var(--warning)_22%,transparent)]",
    active:
      "border-primary-border bg-primary-subtle ring-2 ring-ring/30",
    completed:
      "border-[color-mix(in_srgb,var(--success)_35%,var(--border))] bg-success-subtle",
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
  const goal =
    response?.plan.goal ??
    "Cuando envíes tu primer briefing, aquí guardaremos la esencia del viaje — no solo fechas, sino el tono que buscas.";

  return (
    <div className="flex flex-col gap-5">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="ato-noise ato-glass rounded-2xl"
      >
        <CardHeader className="pb-2">
          <span className="ato-kicker mb-1">Esencia</span>
          <CardTitle className="font-ato-display normal-case tracking-normal text-lg font-medium text-foreground">
            Lo que estamos protegiendo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {goal}
          </p>
        </CardContent>
      </motion.div>

      <div className="ato-noise ato-glass rounded-2xl">
        <CardHeader className="pb-2">
          <span className="ato-kicker mb-1">Equilibrio</span>
          <CardTitle className="font-ato-display normal-case tracking-normal text-lg font-medium text-foreground">
            Cómo pesamos precio y confort
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <Label className="mb-2 block text-xs uppercase tracking-wider">
              Techo en USD (orientativo)
            </Label>
            <Input
              type="number"
              min={0}
              step={50}
              placeholder="ej. 2 400"
              value={maxPriceUsd}
              onChange={(e) => onMaxPriceChange(e.target.value)}
              className="rounded-lg"
            />
          </div>
          <div>
            <div className="mb-3 flex justify-between text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              <span>Más ahorro</span>
              <span>Más bienestar</span>
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
      </div>

      <div className="ato-noise ato-glass rounded-2xl">
        <CardHeader className="pb-2">
          <span className="ato-kicker mb-1">Ritmo</span>
          <CardTitle className="font-ato-display normal-case tracking-normal text-lg font-medium text-foreground">
            Por dónde va el viaje
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {stages.map((s) => (
              <li key={s.id} className="flex items-center gap-3 text-sm">
                <StageDot state={s.state} />
                <span
                  className={cn(
                    s.state === "locked" && "text-muted-foreground/65",
                    s.state === "waiting" && "font-medium text-warning",
                    s.state === "active" && "font-medium text-primary",
                    s.state === "completed" && "text-foreground/80",
                  )}
                >
                  {s.label}
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </div>

      <div className="rounded-xl border border-dashed border-border bg-muted/40 px-4 py-4 text-[11px] leading-relaxed text-muted-foreground">
        <p className="font-mono text-[10px] text-foreground/75">
          {response?.adgGraphVersionId
            ? `Versión activa · ${response.adgGraphVersionId.slice(0, 8)}…`
            : "Aún sin huella persistente en el grafo."}
        </p>
        <p className="mt-2">
          Las ramas alternativas llegarán después: por ahora una sola línea de
          decisión digna de un buen viaje.
        </p>
      </div>
    </div>
  );
}
