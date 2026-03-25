"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import { type WorkspaceStage, WORKSPACE_STAGES, stageIndex } from "../workflow/types";

const LABELS: Record<WorkspaceStage, string> = {
  define_trip: "Definir viaje",
  select_flight: "Vuelo",
  select_hotel: "Hotel",
  review_trip: "Revisar",
  approve: "Aprobar",
  execute_ready: "Operar",
};

export function StageProgressRail({
  currentStage,
  className,
}: {
  currentStage: WorkspaceStage;
  className?: string;
}): React.ReactElement {
  const currentIdx = stageIndex(currentStage);

  return (
    <nav
      aria-label="Progreso del itinerario"
      className={cn(
        "w-full overflow-x-auto rounded-xl border border-border bg-card/80 px-3 py-3 shadow-[var(--shadow-soft)] backdrop-blur-sm md:px-4",
        className,
      )}
    >
      <ol className="flex min-w-max items-center gap-1 md:min-w-0 md:justify-between md:gap-2">
        {WORKSPACE_STAGES.map((stage, i) => {
          const isComplete = i < currentIdx;
          const isCurrent = stage === currentStage;
          const isUpcoming = i > currentIdx;

          return (
            <li key={stage} className="flex flex-1 items-center md:min-w-0">
              {i > 0 && (
                <div
                  className={cn(
                    "mx-0.5 hidden h-px flex-1 md:mx-1 md:block",
                    i <= currentIdx ? "bg-primary/35" : "bg-border",
                  )}
                  aria-hidden
                />
              )}
              <motion.div
                layout
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1.5 md:gap-2 md:px-3",
                  isCurrent &&
                    "bg-primary-subtle ring-1 ring-primary-border shadow-sm",
                  isUpcoming && "opacity-55",
                )}
              >
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold md:size-7 md:text-xs",
                    isComplete &&
                      "border-primary/40 bg-primary text-primary-foreground",
                    isCurrent &&
                      !isComplete &&
                      "border-primary bg-primary text-primary-foreground",
                    isUpcoming &&
                      "border-border bg-muted text-muted-foreground",
                  )}
                >
                  {isComplete ? (
                    <Check className="size-3.5" strokeWidth={2.5} />
                  ) : (
                    i + 1
                  )}
                </span>
                <span
                  className={cn(
                    "hidden max-w-[5.5rem] truncate text-[10px] font-medium uppercase tracking-wider sm:inline md:max-w-none md:text-[11px]",
                    isCurrent && "text-foreground",
                    !isCurrent && "text-muted-foreground",
                  )}
                >
                  {LABELS[stage]}
                </span>
              </motion.div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
