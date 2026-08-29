import { apiRequest } from "./http";

export interface AssistantAction {
  id: string;
  label: string;
  href: string;
}

export interface AssistantHistoryMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AssistantReply {
  answer: string;
  actions: AssistantAction[];
  followUps: string[];
  source: "ai" | "knowledge";
}

export type AssistantFeedbackType =
  | "helpful"
  | "not_helpful"
  | "incorrect"
  | "unanswered";

export function recordAssistantFeedback(input: {
  type: AssistantFeedbackType;
  question: string;
  answer: string;
  source: "ai" | "knowledge";
  currentPath?: string;
  details?: string;
}): Promise<{ recorded: boolean }> {
  return apiRequest<{ recorded: boolean }>("/assistant/feedback", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function askAssistant(input: {
  message: string;
  history?: AssistantHistoryMessage[];
  currentPath?: string;
}): Promise<AssistantReply> {
  return apiRequest<AssistantReply>("/assistant/ask", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getAssistantPrompts(): Promise<{ prompts: string[] }> {
  return apiRequest<{ prompts: string[] }>("/assistant/prompts");
}
