"use client";

import * as React from "react";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";

/**
 * Anima el centro cuando cambia la etapa y mantiene ritmo vertical consistente.
 */
export function CenterStageHost({
  stageKey,
  children,
  className,
}: {
  stageKey: string;
  children: React.ReactNode;
  className?: string;
}): React.ReactElement {
  return (
    <motion.div
      key={stageKey}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
      className={cn("flex flex-col gap-8 md:gap-10", className)}
    >
      {children}
    </motion.div>
  );
}

/**
 * Bloque secundario atenuado (etapas no activas o resúmenes).
 */
export function MutedStageFold({
  title,
  description,
  defaultOpen = false,
  children,
}: {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <details
      className="group rounded-xl border border-border/70 bg-card/45 shadow-[var(--shadow-soft)] open:border-border"
      open={defaultOpen}
    >
      <summary className="cursor-pointer list-none px-4 py-3 transition-colors marker:content-none [&::-webkit-details-marker]:hidden">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {title}
          </span>
          <span className="text-[10px] text-muted-foreground/80 group-open:hidden">
            Expandir
          </span>
        </div>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground/90">{description}</p>
        )}
      </summary>
      <div className="border-t border-border/60 px-4 py-4 opacity-95">
        {children}
      </div>
    </details>
  );
}
