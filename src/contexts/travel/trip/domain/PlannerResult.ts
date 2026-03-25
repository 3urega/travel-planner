import type { Plan } from "./Plan";

/** Rol de un dato que el planner puede pedir (lista cerrada). */
export type PlannerSlotRole = "outbound_date" | "return_date" | "destination";

export type PlannerMissingSlot = {
  id: string;
  role: PlannerSlotRole;
  /** Etiqueta corta para la UI (idioma del usuario). */
  label: string;
};

/**
 * Salida del planner LLM tras validación Zod: o pide datos o devuelve plan ejecutable.
 */
export type PlannerGenerateResult =
  | {
      kind: "need_input";
      assistantMessage: string;
      missingSlots: PlannerMissingSlot[];
    }
  | {
      kind: "plan";
      plan: Plan;
    };
