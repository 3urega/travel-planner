/**
 * Niveles de aprobación del sistema ATO:
 * - auto:    acción informativa, se ejecuta sin intervención humana.
 * - confirm: riesgo medio (coste moderado), requiere 1 confirmación.
 * - double:  alto riesgo (compra / coste elevado), requiere 2 confirmaciones.
 * - blocked: nunca permitido; solo para extensiones futuras.
 */
export type ApprovalLevel = "auto" | "confirm" | "double" | "blocked";

export type ApprovalPolicyResult = {
  level: ApprovalLevel;
  reason: string;
};
