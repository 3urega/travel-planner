"use client";

import * as React from "react";

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
    <header className="sticky top-0 z-30 border-b border-border bg-[color-mix(in_srgb,var(--card-elevated)_82%,transparent)] backdrop-blur-xl backdrop-saturate-150">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      <div className="mx-auto flex max-w-[1680px] flex-col gap-4 px-4 py-5 lg:flex-row lg:items-end lg:justify-between lg:px-10">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <span className="ato-kicker">Itinerario asistido</span>
            <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
          </div>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h1 className="font-ato-display text-2xl font-medium leading-[1.15] tracking-[-0.02em] text-foreground md:text-3xl">
              {trip.title}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted-foreground">
            <span className="font-mono text-xs text-[color-mix(in_srgb,var(--primary)_42%,var(--muted-foreground))]">
              {trip.route}
            </span>
            <span className="text-foreground/90">{trip.dates}</span>
            <span>{trip.travelers}</span>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" type="button" disabled>
            Compartir ruta
          </Button>
          <Button variant="subtle" size="sm" type="button" disabled>
            Guardar versión
          </Button>
        </div>
      </div>
    </header>
  );
}
