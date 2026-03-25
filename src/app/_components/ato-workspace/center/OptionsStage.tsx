"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { ATOResponse } from "@/contexts/travel/trip/domain/ATOResponse";
import type { PendingSelectionItem } from "@/contexts/travel/trip/domain/GraphExecutionCheckpoint";
import type { DecisionRecord } from "@/contexts/travel/trip/domain/DecisionRecord";
import { cn } from "@/lib/utils";

export function OptionsStage({
  response,
  busyKey,
  onSelectOption,
}: {
  response: ATOResponse | null;
  busyKey: string | null;
  onSelectOption: (item: PendingSelectionItem, optionId: string) => void;
}): React.ReactElement {
  const pending = response?.pendingSelections ?? [];
  const showDecisions =
    response &&
    pending.length === 0 &&
    response.decisions.length > 0;

  return (
    <div className="space-y-4">
      <AnimatePresence mode="wait">
        {pending.length > 0 && (
          <motion.div
            key="pending"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
          >
            {pending.map((item) => (
              <Card
                key={item.selectionRequestLogicalId}
                className="border-amber-900/50"
              >
                <CardHeader>
                  <CardTitle className="text-amber-100/90">
                    {item.selectionKind === "flight" ? "Vuelos" : "Hoteles"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="mb-2 text-sm text-zinc-400">{item.title}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {item.options.map((opt) => {
                      const k = `${item.selectionRequestLogicalId}:${opt.id}`;
                      const loading = busyKey === k;
                      return (
                        <Button
                          key={opt.id}
                          variant="subtle"
                          className={cn(
                            "h-auto min-h-[4rem] flex-col items-start gap-1 py-3 text-left",
                            loading && "opacity-70",
                          )}
                          disabled={Boolean(busyKey)}
                          onClick={() => onSelectOption(item, opt.id)}
                        >
                          <span className="font-medium text-zinc-100">
                            {opt.label}
                          </span>
                          {opt.priceUsd !== undefined && (
                            <span className="text-xs tabular-nums text-zinc-500">
                              ${opt.priceUsd}
                            </span>
                          )}
                          {loading && (
                            <span className="text-xs text-emerald-400">
                              Aplicando…
                            </span>
                          )}
                        </Button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {showDecisions && (
        <Card>
          <CardHeader>
            <CardTitle>Alternativas evaluadas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {response!.decisions.map((d: DecisionRecord) => (
              <div key={d.id} className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
                <p className="text-xs font-medium capitalize text-zinc-400">
                  {d.category}
                </p>
                <p className="mt-1 text-xs text-zinc-500">{d.justification}</p>
                <ul className="mt-2 space-y-1">
                  {d.options.slice(0, 4).map((o) => (
                    <li
                      key={o.id}
                      className={cn(
                        "text-xs",
                        o.chosen ? "text-emerald-300" : "text-zinc-400",
                      )}
                    >
                      {o.label}{" "}
                      <span className="tabular-nums text-zinc-600">
                        ({o.totalScore.toFixed(2)})
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
