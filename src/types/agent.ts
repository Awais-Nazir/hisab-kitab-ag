export type PendingActionType =
  | "expense"
  | "udhar"
  | "settlement"
  | "udhar_settle"
  | string;

export type PendingAction = {
  action_id: string;
  type: PendingActionType;
  status: "pending" | "confirmed" | "rejected" | string;
  proposal: Record<string, any>;
};

export type ChatRequest = {
  message: string;
  session_id?: string | null;
};

export type ChatResponse = {
  session_id: string;
  reply: string;
  pending_action: PendingAction | null;
};

export type ActionRequest = {
  session_id: string;
  action_id: string;
};

export type ActionResponse = {
  action_id: string;
  status: "confirmed" | "rejected" | string;
  type: string;
  result?: Record<string, unknown> | null;
};

export type ChatMessage = {
  id: string;
  sender: "user" | "assistant" | "system";
  text: string;
  timestamp: string;
  pendingAction?: PendingAction | null;
};
