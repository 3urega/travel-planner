export type SessionStatus =
  | "active"
  | "awaiting_approval"
  | "completed"
  | "cancelled";

export type Session = {
  id: string;
  goal: string;
  status: SessionStatus;
  planId: string | null;
  preferences: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};
