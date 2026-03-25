"use client";

import * as React from "react";
import { ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ATOResponse } from "@/contexts/travel/trip/domain/ATOResponse";
import type { PendingApprovalItem } from "@/contexts/travel/trip/domain/ATOResponse";
import { findDecisionForCategory } from "../workflow/deriveWorkflowState";

function levelBadge(
  level: PendingApprovalItem["level"],
): "default" | "warning" | "success" {
  if (level === "auto") return "success";
  if (level === "blocked") return "default";
  return "warning";
}

export function ApprovalStagePanel({
  response,
}: {
  response: ATOResponse;
}): React.ReactElement {
  const approvals = response.pendingApprovals;
  const flight = findDecisionForCategory(response.decisions, "flight");
  const hotel = findDecisionForCategory(response.decisions, "hotel");
  const flightOpt = flight?.options.find(
    (o) => o.id === (flight.userChosenId ?? flight.chosenId),
  );
  const hotelOpt = hotel?.options.find(
    (o) => o.id === (hotel.userChosenId ?? hotel.chosenId),
  );

  return (
    <div className="ato-noise ato-glass relative overflow-hidden rounded-2xl">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      <CardHeader className="flex flex-row flex-wrap items-start gap-3 pb-2 md:px-8 md:pt-8">
        <span className="mt-1 rounded-full border border-border bg-accent p-2 text-primary">
          <ShieldCheck className="size-5" strokeWidth={1.35} />
        </span>
        <div>
          <span className="ato-kicker mb-1 block">Aprobación</span>
          <CardTitle className="font-ato-display normal-case tracking-normal text-2xl text-foreground">
            Todo listo para tu confirmación tranquila
          </CardTitle>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Revisa lo esencial: el sistema no avanzará con acciones sensibles sin
            que entiendas qué queda pendiente de política.
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 md:px-8 md:pb-8">
        <div className="grid gap-4 rounded-xl border border-border bg-card-elevated/90 p-4 shadow-[var(--shadow-soft)] sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Vuelo elegido
            </p>
            <p className="mt-1 font-medium text-foreground">
              {flightOpt?.label ?? "—"}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Estancia elegida
            </p>
            <p className="mt-1 font-medium text-foreground">
              {hotelOpt?.label ?? "—"}
            </p>
          </div>
          {response.simulation.totalEstimatedCost > 0 && (
            <div className="sm:col-span-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Estimación conjunta
              </p>
              <p className="mt-1 font-ato-display text-xl font-medium text-primary tabular-nums">
                ${response.simulation.totalEstimatedCost}
              </p>
            </div>
          )}
        </div>

        <ul className="space-y-3">
          {approvals.map((a) => (
            <li
              key={a.stepId}
              className="rounded-xl border border-border bg-card px-4 py-4 shadow-[var(--shadow-soft)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-sm font-medium text-foreground">
                  {a.description}
                </p>
                <Badge variant={levelBadge(a.level)}>{a.level}</Badge>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {a.reason}
              </p>
              {a.estimatedCost !== undefined && (
                <p className="mt-2 text-xs text-muted-foreground tabular-nums">
                  Estimado: ${a.estimatedCost}
                </p>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </div>
  );
}
