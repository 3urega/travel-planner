"use client";

import * as React from "react";
import { Activity } from "lucide-react";

import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ATOResponse } from "@/contexts/travel/trip/domain/ATOResponse";

export function ExecuteStagePanel({
  response,
}: {
  response: ATOResponse;
}): React.ReactElement {
  const recentAudit = response.auditEvents.slice(-6).reverse();

  return (
    <div className="ato-noise ato-glass-elevated relative overflow-hidden rounded-2xl">
      <CardHeader className="flex flex-row flex-wrap items-start gap-3 md:px-8 md:pt-8">
        <span className="mt-1 rounded-full border border-border bg-accent p-2 text-primary">
          <Activity className="size-5" strokeWidth={1.35} />
        </span>
        <div>
          <span className="ato-kicker mb-1 block">Operación</span>
          <CardTitle className="font-ato-display normal-case tracking-normal text-2xl text-foreground">
            Estado de ejecución
          </CardTitle>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            El operador puede actuar sobre pasos ya validados. Aquí ves qué se
            ha materializado y la huella en auditoría.
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 md:px-8 md:pb-8">
        <div className="rounded-xl border border-border bg-card px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Pasos ejecutados ({response.executedSteps.length})
          </p>
          {response.executedSteps.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Aún no hay pasos materializados en esta sesión.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {response.executedSteps.map((row) => (
                <li
                  key={row.stepId}
                  className="font-mono text-xs text-foreground/90"
                >
                  {row.stepId}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card px-4 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Grafos
          </p>
          <p className="mt-2 font-mono text-xs text-muted-foreground">
            graph: {response.adgGraphId ?? "—"}
          </p>
          <p className="font-mono text-xs text-muted-foreground">
            version: {response.adgGraphVersionId ?? "—"}
          </p>
        </div>

        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Cronología reciente
          </p>
          <ul className="space-y-2">
            {recentAudit.length === 0 && (
              <li className="text-xs text-muted-foreground">Sin eventos.</li>
            )}
            {recentAudit.map((e) => (
              <li
                key={e.id}
                className="rounded-lg border border-border/80 bg-card-elevated/80 px-3 py-2 text-xs"
              >
                <span className="font-medium text-foreground">{e.type}</span>
                {e.reason && (
                  <p className="mt-0.5 text-muted-foreground">{e.reason}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </div>
  );
}
