"use client";

import * as React from "react";
import { Share2, Save, GitBranch } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { HeaderTripMeta, TripStatusBadge } from "../adapters";

export function WorkspaceHeader({
  trip,
  statusBadge,
}: {
  trip: HeaderTripMeta;
  statusBadge: TripStatusBadge;
}): React.ReactElement {
  return (
    <header className="sticky top-0 z-30 border-b border-zinc-800/90 bg-zinc-950/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-3 px-4 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-lg font-semibold tracking-tight text-zinc-50 lg:text-xl">
              {trip.title}
            </h1>
            <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
            <span className="font-mono text-zinc-400">{trip.route}</span>
            <span>{trip.dates}</span>
            <span>{trip.travelers}</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button variant="subtle" size="sm" type="button" disabled>
            <Save className="opacity-70" />
            Guardar
          </Button>
          <Button variant="outline" size="sm" type="button" disabled>
            <Share2 className="opacity-70" />
            Compartir
          </Button>
          <Button variant="ghost" size="sm" type="button" disabled>
            <GitBranch className="opacity-70" />
            Nueva versión
          </Button>
        </div>
      </div>
    </header>
  );
}
