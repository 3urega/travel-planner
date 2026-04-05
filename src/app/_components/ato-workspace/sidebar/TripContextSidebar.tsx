"use client";

import * as React from "react";
import { motion } from "framer-motion";

import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import type { ATOResponse } from "@/contexts/travel/trip/domain/ATOResponse";
import type {
  FlightStopsPreference,
  FlightTimePreference,
} from "../hooks/useWorkspaceAgent";
import { findDecisionForCategory } from "../workflow/deriveWorkflowState";
import type { WorkspaceWorkflowState } from "../workflow/types";
import { WORKSPACE_STAGES, stageIndex } from "../workflow/types";

const STAGE_LABELS: Record<string, string> = {
  define_trip: "Definir viaje",
  select_flight: "Elegir vuelo",
  select_hotel: "Elegir hotel",
  review_trip: "Revisar viaje",
  approve: "Aprobar",
  execute_ready: "Operar",
};

function StageDot({
  state,
}: {
  state: "locked" | "waiting" | "active" | "completed";
}): React.ReactElement {
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

function chosenLabel(
  response: ATOResponse | null,
  kind: "flight" | "hotel",
): string {
  if (!response) return "—";
  const d = findDecisionForCategory(response.decisions, kind);
  if (!d) return "Pendiente";
  const id = d.userChosenId ?? d.chosenId;
  const o = d.options.find((x) => x.id === id);
  return o?.label ?? "Elegido";
}

export function TripContextSidebar({
  response,
  workflow,
  priceComfortSlider,
  onPriceComfortChange,
  maxPriceUsd,
  onMaxPriceChange,
  flightStopsPreference,
  onFlightStopsPreferenceChange,
  flightTimePreference,
  onFlightTimePreferenceChange,
}: {
  response: ATOResponse | null;
  workflow: WorkspaceWorkflowState;
  priceComfortSlider: number;
  onPriceComfortChange: (v: number) => void;
  maxPriceUsd: string;
  onMaxPriceChange: (v: string) => void;
  flightStopsPreference: FlightStopsPreference;
  onFlightStopsPreferenceChange: (v: FlightStopsPreference) => void;
  flightTimePreference: FlightTimePreference;
  onFlightTimePreferenceChange: (v: FlightTimePreference) => void;
}): React.ReactElement {
  const goal =
    response?.plan.goal ??
    "Cuando envíes tu primer briefing, aquí guardaremos la esencia del viaje — no solo fechas, sino el tono que buscas.";

  const curIdx = stageIndex(workflow.currentStage);
  const productStageRows = WORKSPACE_STAGES.map((id) => {
    const i = stageIndex(id);
    let state: "locked" | "waiting" | "active" | "completed";
    if (i < curIdx) state = "completed";
    else if (i === curIdx) state = "active";
    else state = "locked";
    if (id === "approve" && workflow.requiresApproval && state === "active") {
      state = "waiting";
    }
    return { id, label: STAGE_LABELS[id] ?? id, state };
  });

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
            Objetivo del viaje
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
          <span className="ato-kicker mb-1">Selección</span>
          <CardTitle className="font-ato-display normal-case tracking-normal text-lg font-medium text-foreground">
            Qué llevas cerrado
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Vuelo
            </p>
            <p
              className={cn(
                "mt-0.5",
                workflow.selectedFlightId
                  ? "text-foreground"
                  : "text-muted-foreground",
              )}
            >
              {chosenLabel(response, "flight")}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Hotel
            </p>
            <p
              className={cn(
                "mt-0.5",
                workflow.selectedHotelId
                  ? "text-foreground"
                  : "text-muted-foreground",
              )}
            >
              {chosenLabel(response, "hotel")}
            </p>
          </div>
        </CardContent>
      </div>

      <div className="ato-noise ato-glass rounded-2xl">
        <CardHeader className="pb-2">
          <span className="ato-kicker mb-1">Equilibrio</span>
          <CardTitle className="font-ato-display normal-case tracking-normal text-lg font-medium text-foreground">
            Presupuesto y confort
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
          <span className="ato-kicker mb-1">Vuelo</span>
          <CardTitle className="font-ato-display normal-case tracking-normal text-lg font-medium text-foreground">
            Preferencias de cabina y horario
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Escalas
            </p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { id: "any" as const, label: "Cualquiera" },
                  { id: "nonstop" as const, label: "Solo directo" },
                  { id: "one_stop" as const, label: "Hasta 1 escala" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onFlightStopsPreferenceChange(opt.id)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors",
                    flightStopsPreference === opt.id
                      ? "border-primary-border bg-primary-subtle text-foreground"
                      : "border-border bg-background text-muted-foreground hover:border-primary-border hover:bg-primary-subtle/50",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Franja de salida
            </p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { id: "any" as const, label: "Sin preferencia" },
                  { id: "morning" as const, label: "Mañana" },
                  { id: "afternoon" as const, label: "Tarde" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onFlightTimePreferenceChange(opt.id)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-[11px] font-medium transition-colors",
                    flightTimePreference === opt.id
                      ? "border-primary-border bg-primary-subtle text-foreground"
                      : "border-border bg-background text-muted-foreground hover:border-primary-border hover:bg-primary-subtle/50",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
              Se aplican en la próxima búsqueda y al re-rankear la shortlist
              (peso suave en franja horaria).
            </p>
          </div>
        </CardContent>
      </div>

      <div className="ato-noise ato-glass rounded-2xl">
        <CardHeader className="pb-2">
          <span className="ato-kicker mb-1">Progreso</span>
          <CardTitle className="font-ato-display normal-case tracking-normal text-lg font-medium text-foreground">
            Etapas del flujo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {productStageRows.map((s) => (
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
          El panel central muestra la etapa que manda; aquí el contexto que la
          sostiene.
        </p>
      </div>
    </div>
  );
}
