"use client";

import * as React from "react";

import { Skeleton } from "@/components/ui/skeleton";
import type { WorkspaceStage } from "../workflow/types";

export function StageLoadingSkeleton({
  stage,
}: {
  stage: WorkspaceStage;
}): React.ReactElement {
  if (stage === "define_trip") {
    return (
      <div className="space-y-4 rounded-2xl border border-border bg-card/50 p-6">
        <Skeleton className="h-4 w-1/3 rounded-md" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-10 w-40 rounded-lg" />
      </div>
    );
  }

  if (stage === "select_flight" || stage === "select_hotel") {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="space-y-3 rounded-xl border border-border bg-card/50 p-5"
          >
            <Skeleton className="h-5 w-4/5 rounded-md" />
            <Skeleton className="h-4 w-1/3 rounded-md" />
            <Skeleton className="h-3 w-full rounded-md" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card/50 p-6">
      <Skeleton className="h-6 w-2/3 rounded-md" />
      <Skeleton className="h-4 w-full rounded-md" />
      <Skeleton className="h-4 w-5/6 rounded-md" />
      <Skeleton className="h-32 w-full rounded-xl" />
    </div>
  );
}
