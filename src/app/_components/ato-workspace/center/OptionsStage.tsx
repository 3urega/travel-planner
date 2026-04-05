"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Hotel, Plane } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ATOResponse } from "@/contexts/travel/trip/domain/ATOResponse";
import type { PendingSelectionItem } from "@/contexts/travel/trip/domain/GraphExecutionCheckpoint";
import type { DecisionRecord } from "@/contexts/travel/trip/domain/DecisionRecord";
import type { FlightRefinementFilters } from "@/contexts/travel/trip/application/flights/flightRefinementTypes";
import { cn } from "@/lib/utils";

import { findDecisionForCategory } from "../workflow/deriveWorkflowState";
import { getCatalogRecommendation } from "../workflow/catalogHints";

const listVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.06 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 14, filter: "blur(6px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export function OptionsStage({
  response,
  busyKey,
  onSelectOption,
  onRefineFlight,
  filterKind = null,
  showDecisionMemorial = true,
}: {
  response: ATOResponse | null;
  busyKey: string | null;
  onSelectOption: (item: PendingSelectionItem, optionId: string) => void;
  /** Re-cura la shortlist de vuelos desde el cache del grafo (sin nueva búsqueda). */
  onRefineFlight?: (
    item: PendingSelectionItem,
    filters: FlightRefinementFilters,
  ) => void;
  /** Si se define, solo se muestran pendientes de ese tipo (alineado a la etapa activa). */
  filterKind?: "flight" | "hotel" | null;
  showDecisionMemorial?: boolean;
}): React.ReactElement {
  const pending = React.useMemo(() => {
    const raw = response?.pendingSelections ?? [];
    return filterKind
      ? raw.filter((p) => p.selectionKind === filterKind)
      : raw;
  }, [response, filterKind]);

  const showDecisions =
    Boolean(response) &&
    pending.length === 0 &&
    showDecisionMemorial &&
    (response?.decisions.length ?? 0) > 0;

  return (
    <div className="space-y-6">
      <AnimatePresence mode="wait">
        {pending.length > 0 && (
          <motion.div
            key="pending"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35 }}
          >
            {pending.map((item) => {
              const rec =
                response ? getCatalogRecommendation(response, item.selectionKind) : null;
              const decision = response
                ? findDecisionForCategory(response.decisions, item.selectionKind)
                : undefined;
              const ctaVerb =
                item.selectionKind === "flight"
                  ? "Usar este vuelo"
                  : "Elegir esta estancia";

              return (
                <div
                  key={item.selectionRequestLogicalId}
                  className="ato-noise ato-glass relative overflow-hidden rounded-2xl"
                >
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary-wash via-transparent to-transparent" />
                  <CardHeader className="relative pb-2 pt-7 md:px-8">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="flex size-10 items-center justify-center rounded-full border border-border bg-accent text-primary shadow-[var(--shadow-soft)]">
                        {item.selectionKind === "flight" ? (
                          <Plane className="size-5" strokeWidth={1.35} />
                        ) : (
                          <Hotel className="size-5" strokeWidth={1.35} />
                        )}
                      </span>
                      <div>
                        <CardTitle className="font-ato-display normal-case tracking-normal text-xl font-medium text-foreground md:text-2xl">
                          {item.selectionKind === "flight"
                            ? "Tramos aéreos"
                            : "Estancia"}
                        </CardTitle>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {item.title}
                        </p>
                        {item.selectionKind === "flight" &&
                          item.totalFound !== undefined &&
                          item.totalFound > 0 && (
                            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-foreground/85">
                              Hemos encontrado{" "}
                              <span className="font-semibold text-primary">
                                {item.totalFound}
                              </span>{" "}
                              {item.totalFound === 1 ? "opción" : "opciones"}.
                              Estas son las que mejor encajan contigo.
                            </p>
                          )}
                        {rec && (
                          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted-foreground">
                            <span className="font-medium text-primary">
                              Sugerencia del sistema:{" "}
                            </span>
                            {rec.blurb}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="relative space-y-4 pb-8 md:px-8">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      Elige con intención — el plan sigue en silencio hasta tu
                      voto
                    </p>
                    {item.selectionKind === "flight" &&
                      onRefineFlight &&
                      response?.adgGraphVersionId && (
                        <div className="space-y-2 rounded-xl border border-border/70 bg-card-elevated/40 px-3 py-3">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Afinar shortlist
                          </p>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={Boolean(busyKey)}
                              onClick={() =>
                                onRefineFlight(item, { maxStops: 0 })
                              }
                              className="rounded-full border border-border bg-background px-3 py-1 text-[11px] font-medium text-foreground transition-colors hover:border-primary-border hover:bg-primary-subtle disabled:opacity-50"
                            >
                              Solo directos
                            </button>
                            <button
                              type="button"
                              disabled={Boolean(busyKey)}
                              onClick={() =>
                                onRefineFlight(item, { maxStops: 2 })
                              }
                              className="rounded-full border border-border bg-background px-3 py-1 text-[11px] font-medium text-foreground transition-colors hover:border-primary-border hover:bg-primary-subtle disabled:opacity-50"
                            >
                              Hasta 2 escalas
                            </button>
                            <button
                              type="button"
                              disabled={Boolean(busyKey)}
                              onClick={() =>
                                onRefineFlight(item, { preferMorning: true })
                              }
                              className="rounded-full border border-border bg-background px-3 py-1 text-[11px] font-medium text-foreground transition-colors hover:border-primary-border hover:bg-primary-subtle disabled:opacity-50"
                            >
                              Salida mañana
                            </button>
                            <button
                              type="button"
                              disabled={Boolean(busyKey)}
                              onClick={() =>
                                onRefineFlight(item, { preferAfternoon: true })
                              }
                              className="rounded-full border border-border bg-background px-3 py-1 text-[11px] font-medium text-foreground transition-colors hover:border-primary-border hover:bg-primary-subtle disabled:opacity-50"
                            >
                              Salida tarde
                            </button>
                            <button
                              type="button"
                              disabled={Boolean(busyKey)}
                              onClick={() => {
                                const prices =
                                  decision?.options.map((o) => o.price) ?? [];
                                const minP =
                                  prices.length > 0 ? Math.min(...prices) : 0;
                                const cap =
                                  minP > 0
                                    ? Math.max(80, Math.round(minP * 0.92))
                                    : undefined;
                                if (cap !== undefined) {
                                  onRefineFlight(item, { maxPriceUsd: cap });
                                }
                              }}
                              className="rounded-full border border-border bg-background px-3 py-1 text-[11px] font-medium text-foreground transition-colors hover:border-primary-border hover:bg-primary-subtle disabled:opacity-50"
                            >
                              Más barato
                            </button>
                            <button
                              type="button"
                              disabled={Boolean(busyKey)}
                              onClick={() => onRefineFlight(item, {})}
                              className="rounded-full border border-dashed border-muted-foreground/40 bg-muted/30 px-3 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary-border hover:bg-primary-subtle disabled:opacity-50"
                            >
                              Quitar filtros
                            </button>
                          </div>
                        </div>
                      )}
                    <motion.div
                      className="grid gap-3 sm:grid-cols-2"
                      variants={listVariants}
                      initial="hidden"
                      animate="show"
                    >
                      {item.options.map((opt) => {
                        const k = `${item.selectionRequestLogicalId}:${opt.id}`;
                        const loading = busyKey === k;
                        const isRecommended = rec?.optionId === opt.id;
                        const scored = decision?.options.find((o) => o.id === opt.id);

                        return (
                          <motion.button
                            key={opt.id}
                            type="button"
                            variants={itemVariants}
                            disabled={Boolean(busyKey)}
                            onClick={() => onSelectOption(item, opt.id)}
                            whileHover={
                              busyKey ? undefined : { y: -2, scale: 1.008 }
                            }
                            whileTap={busyKey ? undefined : { scale: 0.996 }}
                            transition={{
                              type: "spring",
                              stiffness: 420,
                              damping: 28,
                            }}
                            className={cn(
                              "group relative flex min-h-[5.5rem] flex-col items-start gap-2 rounded-xl border border-border bg-card-elevated px-5 py-4 text-left shadow-[0_1px_0_hsl(0_0%_100%_/_0.75)_inset,var(--shadow-soft)] transition-[border-color,box-shadow,background-color]",
                              "hover:border-primary-border hover:bg-primary-subtle",
                              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                              isRecommended &&
                                "border-primary-border/80 ring-1 ring-primary/15",
                              loading &&
                                "border-primary-border bg-primary-subtle shadow-[var(--shadow-selected)] ring-2 ring-ring/35",
                            )}
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-ato-display text-lg font-medium leading-snug text-foreground">
                                {opt.label}
                              </span>
                              {item.selectionKind === "flight" &&
                                opt.tags &&
                                opt.tags[0] && (
                                  <Badge
                                    variant="secondary"
                                    className="border border-primary/35 bg-primary/5 text-[10px] font-medium text-primary"
                                  >
                                    {opt.tags[0]}
                                  </Badge>
                                )}
                              {isRecommended && (
                                <Badge variant="accent" className="text-[10px]">
                                  Recomendado
                                </Badge>
                              )}
                            </div>
                            {opt.rationale && (
                              <p className="text-xs leading-relaxed text-muted-foreground">
                                {opt.rationale}
                              </p>
                            )}
                            {opt.priceUsd !== undefined && (
                              <span className="tabular-nums text-sm font-medium text-primary">
                                Desde ${opt.priceUsd}
                              </span>
                            )}
                            {scored && (
                              <span className="text-[11px] text-muted-foreground">
                                Score {scored.totalScore.toFixed(2)} · confort{" "}
                                {(scored.comfort * 100).toFixed(0)}%
                              </span>
                            )}
                            <span className="mt-auto flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                              {loading ? (
                                <>Aplicando tu elección…</>
                              ) : (
                                <>
                                  {ctaVerb}
                                  <ArrowRight className="size-3.5 opacity-70 transition-transform group-hover:translate-x-0.5" />
                                </>
                              )}
                            </span>
                          </motion.button>
                        );
                      })}
                    </motion.div>
                  </CardContent>
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {showDecisions && (
        <div className="ato-noise ato-glass rounded-2xl">
          <CardHeader className="md:px-8">
            <span className="ato-kicker mb-2">Memoria de la mesa</span>
            <CardTitle className="font-ato-display normal-case tracking-normal text-xl text-foreground">
              Cómo leímos las alternativas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5 md:px-8 md:pb-8">
            {response!.decisions.map((d: DecisionRecord) => (
              <div
                key={d.id}
                className="rounded-xl border border-border bg-card-elevated px-4 py-4 shadow-[var(--shadow-soft)]"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  {d.category}
                </p>
                <p className="mt-2 text-sm leading-relaxed text-foreground/90">
                  {d.justification}
                </p>
                <ul className="mt-4 space-y-2 border-t border-border pt-3">
                  {d.options.slice(0, 4).map((o) => (
                    <li
                      key={o.id}
                      className={cn(
                        "flex justify-between gap-3 text-sm",
                        o.chosen
                          ? "font-medium text-primary"
                          : "text-muted-foreground",
                      )}
                    >
                      <span>{o.label}</span>
                      <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                        {o.totalScore.toFixed(2)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </div>
      )}
    </div>
  );
}
