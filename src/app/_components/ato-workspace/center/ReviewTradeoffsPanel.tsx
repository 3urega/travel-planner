"use client";

import * as React from "react";

import type { DecisionRecord } from "@/contexts/travel/trip/domain/DecisionRecord";
import { cn } from "@/lib/utils";

export function ReviewTradeoffsPanel({
  decisions,
}: {
  decisions: DecisionRecord[];
}): React.ReactElement {
  if (decisions.length === 0) return <></>;

  return (
    <div className="rounded-xl border border-border bg-card/80 px-4 py-4 shadow-[var(--shadow-soft)] md:px-5">
      <div className="pb-3">
        <span className="ato-kicker mb-1">Tradeoffs</span>
        <h3 className="font-ato-display text-lg font-medium text-foreground">
          Cómo equilibramos precio y confort
        </h3>
      </div>
      <div className="space-y-4">
        {decisions.map((d) => (
          <div key={d.id}>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {d.category}
            </p>
            <p className="mt-1 text-sm text-foreground/90">{d.justification}</p>
            <ul className="mt-2 space-y-1">
              {d.options.slice(0, 4).map((o) => (
                <li
                  key={o.id}
                  className={cn(
                    "flex flex-wrap justify-between gap-x-3 text-xs",
                    o.chosen
                      ? "font-medium text-primary"
                      : "text-muted-foreground",
                  )}
                >
                  <span>{o.label}</span>
                  <span className="tabular-nums">
                    ${o.price.toFixed(0)} · score {o.totalScore.toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
