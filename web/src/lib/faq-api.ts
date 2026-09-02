import type { Faq } from "./types";
import { apiRequest, authHeader } from "./http";

export interface FaqInput {
  question: string;
  answer: string;
  category?: string;
  sortOrder?: number;
  published?: boolean;
}

export const getAdminFaqs = (token: string) =>
  apiRequest<Faq[]>("/admin/faq", { headers: authHeader(token) });

export const createFaq = (token: string, input: FaqInput) =>
  apiRequest<Faq>("/admin/faq", {
    method: "POST",
    headers: authHeader(token),
    body: JSON.stringify(input),
  });

export const updateFaq = (token: string, id: string, input: Partial<FaqInput>) =>
  apiRequest<Faq>(`/admin/faq/${id}`, {
    method: "PATCH",
    headers: authHeader(token),
    body: JSON.stringify(input),
  });

export const deleteFaq = (token: string, id: string) =>
  apiRequest<{ success: true }>(`/admin/faq/${id}`, {
    method: "DELETE",
    headers: authHeader(token),
  });

// `ids` is the FAQ list's new top-to-bottom order — the service maps
// position to sortOrder.
export const reorderFaqs = (token: string, ids: string[]) =>
  apiRequest<{ success: true }>("/admin/faq/reorder/apply", {
    method: "PATCH",
    headers: authHeader(token),
    body: JSON.stringify({ ids }),
  });
