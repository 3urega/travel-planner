"use client";

import * as React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import type { ATOResponse } from "@/contexts/travel/trip/domain/ATOResponse";
import type { PendingApprovalItem } from "@/contexts/travel/trip/domain/ATOResponse";
import type { AuditEvent } from "@/contexts/travel/trip/domain/AuditEvent";
import { cn } from "@/lib/utils";

function levelStyle(
  level: PendingApprovalItem["level"],
): "default" | "warning" | "success" {
  if (level === "auto") return "success";
  if (level === "blocked") return "default";
  return "warning";
}

function AuditList({ events }: { events: AuditEvent[] }): React.ReactElement {
  const actorColors: Record<string, string> = {
    user: "bg-zinc-700 text-zinc-200",
    system: "bg-emerald-950/80 text-emerald-300",
    llm: "bg-violet-950/70 text-violet-200",
  };

  return (
    <ScrollArea className="h-[280px] rounded-lg border border-zinc-800/80">
      <ol className="space-y-2 p-3">
        {events.length === 0 && (
          <li className="text-xs text-zinc-600">Sin eventos aún.</li>
        )}
        {events.map((e) => (
          <li key={e.id} className="flex flex-col gap-0.5 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 text-[10px] font-medium uppercase",
                  actorColors[e.actor] ?? "bg-zinc-800 text-zinc-400",
                )}
              >
                {e.actor}
              </span>
              <span className="font-medium text-zinc-300">{e.type}</span>
            </div>
            {e.reason && (
              <span className="truncate text-zinc-600">{e.reason}</span>
            )}
          </li>
        ))}
      </ol>
    </ScrollArea>
  );
}

export function InspectorPanel({
  response,
}: {
  response: ATOResponse | null;
}): React.ReactElement {
  const approvals = response?.pendingApprovals ?? [];
  const events = response?.auditEvents ?? [];

  return (
    <div className="flex flex-col gap-4">
      <Card className="border-zinc-800/80">
        <CardHeader>
          <CardTitle>Cola de aprobación</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {approvals.length === 0 ? (
            <p className="text-xs text-zinc-500">
              No hay pasos bloqueados por política.
            </p>
          ) : (
            <ul className="space-y-3">
              {approvals.map((a) => (
                <li
                  key={a.stepId}
                  className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-medium text-zinc-200">
                      {a.description}
                    </span>
                    <Badge variant={levelStyle(a.level)}>{a.level}</Badge>
                  </div>
                  <p className="mt-1 text-[11px] text-zinc-500">{a.reason}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="border-zinc-800/80">
        <CardHeader>
          <CardTitle>Estado ADG</CardTitle>
        </CardHeader>
        <CardContent className="font-mono text-[11px] text-zinc-500">
          <p>graph: {response?.adgGraphId ?? "—"}</p>
          <p>version: {response?.adgGraphVersionId ?? "—"}</p>
        </CardContent>
      </Card>

      <Card className="border-zinc-800/80">
        <CardHeader>
          <CardTitle>Auditoría</CardTitle>
        </CardHeader>
        <CardContent>
          <AuditList events={events} />
        </CardContent>
      </Card>
    </div>
  );
}
