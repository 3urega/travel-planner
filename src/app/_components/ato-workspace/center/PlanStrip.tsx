"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Building2,
  GitBranch,
  Hotel,
  Plane,
  Search,
  ShieldCheck,
  Sparkles,
  Ticket,
} from "lucide-react";

import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Plan } from "@/contexts/travel/trip/domain/Plan";
import type { LucideIcon } from "lucide-react";

const STEP_ICONS: Record<string, LucideIcon> = {
  search_flights: Plane,
  search_hotels: Hotel,
  evaluate_options: Search,
  propose_plan: GitBranch,
  simulate: Sparkles,
  request_approval: ShieldCheck,
  book_flight: Ticket,
  book_hotel: Building2,
};

export function PlanStrip({ plan }: { plan: Plan | null }): React.ReactElement {
  if (!plan || plan.steps.length === 0) return <></>;

  return (
    <div className="ato-noise ato-glass rounded-2xl">
      <CardHeader className="md:px-8">
        <span className="ato-kicker mb-2">Hilo narrativo del plan</span>
        <CardTitle className="font-ato-display normal-case tracking-normal text-xl text-foreground">
          Capítulos que el agente recorrerá por ti
        </CardTitle>
      </CardHeader>
      <CardContent className="md:px-8 md:pb-8">
        <ol className="relative space-y-0 pl-2">
          <div
            className="absolute left-[15px] top-3 bottom-3 w-px bg-gradient-to-b from-primary-border via-border to-transparent"
            aria-hidden
          />
          {plan.steps.map((step, i) => {
            const Icon = STEP_ICONS[step.type] ?? GitBranch;
            return (
              <motion.li
                key={step.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{
                  delay: 0.04 * i,
                  duration: 0.4,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="relative flex gap-4 py-3 first:pt-0 last:pb-0"
              >
                <div className="relative z-[1] flex size-8 shrink-0 items-center justify-center rounded-full border border-primary-border bg-card-elevated text-primary shadow-[0_0_0_6px_var(--background)]">
                  <Icon className="size-4" strokeWidth={1.35} />
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="font-ato-display text-lg font-medium leading-snug text-foreground">
                    {step.description}
                  </p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {step.type.replace(/_/g, " ")}
                  </p>
                </div>
                <span className="hidden pt-1 text-[11px] tabular-nums text-muted-foreground sm:block">
                  {String(i + 1).padStart(2, "0")}
                </span>
              </motion.li>
            );
          })}
        </ol>
      </CardContent>
    </div>
  );
}
