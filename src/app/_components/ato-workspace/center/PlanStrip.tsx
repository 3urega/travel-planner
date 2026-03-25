"use client";

import * as React from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Plan } from "@/contexts/travel/trip/domain/Plan";

const ICONS: Record<string, string> = {
  search_flights: "✈️",
  search_hotels: "🏨",
  evaluate_options: "🔍",
  propose_plan: "📋",
  simulate: "🔮",
  request_approval: "🔐",
  book_flight: "🎫",
  book_hotel: "🛎️",
};

export function PlanStrip({ plan }: { plan: Plan | null }): React.ReactElement {
  if (!plan || plan.steps.length === 0) return <></>;

  return (
    <Card className="border-zinc-800/70">
      <CardHeader>
        <CardTitle>Estructura del plan</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="space-y-2">
          {plan.steps.map((step, i) => (
            <li
              key={step.id}
              className="flex gap-3 rounded-lg border border-zinc-800/60 bg-zinc-950/30 px-3 py-2 text-sm"
            >
              <span className="text-base">{ICONS[step.type] ?? "⚙️"}</span>
              <div className="min-w-0 flex-1">
                <span className="font-medium text-zinc-200">
                  {i + 1}. {step.description}
                </span>
                <div className="mt-0.5 font-mono text-[10px] text-zinc-600">
                  {step.type}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
