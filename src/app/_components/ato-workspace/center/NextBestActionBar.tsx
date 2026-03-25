"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import type { WorkspaceWorkflowState } from "../workflow/types";
import { cn } from "@/lib/utils";

export function NextBestActionBar({
  workflow,
  onPrimaryClick,
  onSecondaryClick,
  primaryLoading,
  className,
}: {
  workflow: WorkspaceWorkflowState;
  onPrimaryClick?: () => void;
  onSecondaryClick?: () => void;
  primaryLoading?: boolean;
  className?: string;
}): React.ReactElement {
  const { headline, primary, secondary } = workflow.nextBestAction;

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-secondary/50 px-4 py-4 shadow-[var(--shadow-soft)] md:px-5",
        className,
      )}
    >
      <p className="font-ato-display text-sm font-medium text-foreground md:text-base">
        {headline}
      </p>
      {(primary || secondary) && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {primary && (
            <Button
              type="button"
              variant="cta"
              size="sm"
              disabled={primary.disabled || primaryLoading || !onPrimaryClick}
              title={primary.hint}
              onClick={() => onPrimaryClick?.()}
              className="rounded-lg"
            >
              {primary.label}
            </Button>
          )}
          {secondary && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={secondary.disabled || !onSecondaryClick}
              title={secondary.hint}
              onClick={() => onSecondaryClick?.()}
              className="rounded-lg"
            >
              {secondary.label}
            </Button>
          )}
        </div>
      )}
      {primary?.hint && primary.disabled && (
        <p className="mt-2 text-xs text-muted-foreground">{primary.hint}</p>
      )}
    </div>
  );
}
