"use client";

import * as React from "react";
import { motion } from "framer-motion";

import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import type { ATOResponse } from "@/contexts/travel/trip/domain/ATOResponse";
import type { PendingApprovalItem } from "@/contexts/travel/trip/domain/ATOResponse";
import type { AuditEvent } from "@/contexts/travel/trip/domain/AuditEvent";
import { cn } from "@/lib/utils";
import type { WorkspaceStage } from "../workflow/types";

function levelStyle(
  level: PendingApprovalItem["level"],
): "default" | "warning" | "success" {
  if (level === "auto") return "success";
  if (level === "blocked") return "default";
  return "warning";
}

function AuditList({ events }: { events: AuditEvent[] }): React.ReactElement {
  const actorColors: Record<string, string> = {
    user:
      "border border-border bg-card-elevated text-foreground",
    system:
      "border border-border bg-accent text-accent-foreground",
    llm:
      "border border-border bg-[color-mix(in_srgb,var(--card-cool)_88%,var(--muted))] text-foreground",
  };

  return (
    <ScrollArea className="h-[260px] rounded-xl border border-[color-mix(in_srgb,var(--secondary-foreground)_12%,var(--border))] bg-[color-mix(in_srgb,var(--card-cool)_65%,var(--card-elevated))]">
      <ol className="space-y-3 p-4">
        {events.length === 0 && (
          <li className="text-xs text-muted-foreground">
            Aún no hay entradas en el registro.
          </li>
        )}
        {events.map((e) => (
          <li key={e.id} className="flex flex-col gap-1 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                  actorColors[e.actor] ?? "bg-muted text-muted-foreground",
                )}
              >
                {e.actor}
              </span>
              <span className="font-medium text-foreground/90">{e.type}</span>
            </div>
            {e.reason && (
              <span className="text-muted-foreground">{e.reason}</span>
            )}
          </li>
        ))}
      </ol>
    </ScrollArea>
  );
}

function DecisionsIntel({
  response,
  compact,
}: {
  response: ATOResponse;
  compact?: boolean;
}): React.ReactElement {
  if (response.decisions.length === 0) return <></>;

  return (
    <div className="ato-noise ato-glass-cool rounded-2xl">
      <CardHeader className="pb-2">
        <span className="ato-kicker mb-1">Razonamiento</span>
        <CardTitle className="font-ato-display normal-case tracking-normal text-lg text-card-cool-foreground">
          Por qué el sistema inclinó la balanza
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {response.decisions.map((d) => (
          <div
            key={d.id}
            className="rounded-lg border border-border/80 bg-card-elevated/60 px-3 py-2"
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {d.category}
            </p>
            <p
              className={cn(
                "mt-1 text-xs leading-relaxed text-foreground/90",
                compact && "line-clamp-4",
              )}
            >
              {d.justification}
            </p>
          </div>
        ))}
      </CardContent>
    </div>
  );
}

export function InspectorPanel({
  response,
  currentStage,
}: {
  response: ATOResponse | null;
  currentStage: WorkspaceStage;
}): React.ReactElement {
  const approvals = response?.pendingApprovals ?? [];
  const events = response?.auditEvents ?? [];

  const showDecisionsIntel =
    response &&
    (currentStage === "select_flight" ||
      currentStage === "select_hotel" ||
      currentStage === "review_trip" ||
      currentStage === "approve" ||
      currentStage === "execute_ready");

  const assistantCard =
    response?.phase === "awaiting_input" && response.assistantMessage ? (
      <div className="ato-noise ato-glass-cool rounded-2xl">
        <CardHeader className="pb-2">
          <span className="ato-kicker mb-1">Asistente</span>
          <CardTitle className="font-ato-display normal-case tracking-normal text-lg text-card-cool-foreground">
            Lo que necesitamos saber
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {response.assistantMessage}
          </p>
        </CardContent>
      </div>
    ) : null;

  const decisionsBlock =
    response && showDecisionsIntel ? (
      <DecisionsIntel
        response={response}
        compact={
          currentStage === "select_flight" || currentStage === "select_hotel"
        }
      />
    ) : null;

  const approvalsBlock = (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.03 }}
      className="ato-noise ato-glass-cool rounded-2xl"
    >
      <CardHeader className="pb-2">
        <span className="ato-kicker mb-1">Líneas rojas</span>
        <CardTitle className="font-ato-display normal-case tracking-normal text-lg text-card-cool-foreground">
          Lo que el sistema no cruza solo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {approvals.length === 0 ? (
          <p className="text-xs leading-relaxed text-muted-foreground">
            Nadie frena el plan por política en este instante — si algo
            aparece, lo verás aquí, claro como una nota en el margen.
          </p>
        ) : (
          <ul className="space-y-3">
            {approvals.map((a) => (
              <li
                key={a.stepId}
                className="rounded-xl border border-[color-mix(in_srgb,var(--secondary-foreground)_12%,var(--border))] bg-card-elevated/95 p-4 shadow-[var(--shadow-soft)]"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-medium text-foreground">
                    {a.description}
                  </span>
                  <Badge variant={levelStyle(a.level)}>{a.level}</Badge>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                  {a.reason}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </motion.div>
  );

  const graphBlock = (
    <div className="ato-noise ato-glass-cool rounded-2xl">
      <CardHeader className="pb-2">
        <span className="ato-kicker mb-1">Huella técnica</span>
        <CardTitle className="font-ato-display normal-case tracking-normal text-lg text-card-cool-foreground">
          Grafo de decisiones
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 font-mono text-[11px] text-muted-foreground">
        <p>
          <span className="text-[color-mix(in_srgb,var(--primary)_32%,var(--muted-foreground))]">
            graph
          </span>{" "}
          {response?.adgGraphId ?? "—"}
        </p>
        <p>
          <span className="text-[color-mix(in_srgb,var(--primary)_32%,var(--muted-foreground))]">
            version
          </span>{" "}
          {response?.adgGraphVersionId ?? "—"}
        </p>
      </CardContent>
    </div>
  );

  const auditBlock = (
    <div className="ato-noise ato-glass-cool rounded-2xl">
      <CardHeader className="pb-2">
        <span className="ato-kicker mb-1">Cronología</span>
        <CardTitle className="font-ato-display normal-case tracking-normal text-lg text-card-cool-foreground">
          Quién dijo qué, y cuándo
        </CardTitle>
      </CardHeader>
      <CardContent>
        <AuditList events={events} />
      </CardContent>
    </div>
  );

  if (currentStage === "define_trip") {
    return (
      <div className="flex flex-col gap-5">
        {assistantCard}
        {graphBlock}
        {auditBlock}
      </div>
    );
  }

  if (
    currentStage === "execute_ready" ||
    currentStage === "approve"
  ) {
    return (
      <div className="flex flex-col gap-5">
        {approvalsBlock}
        {decisionsBlock}
        {auditBlock}
        {graphBlock}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {decisionsBlock}
      {approvalsBlock}
      {graphBlock}
      {auditBlock}
    </div>
  );
}
