import type { PaginatedSupportTickets, SupportMessage, SupportTicket, SupportTicketCategory, SupportTicketPriority, SupportTicketStatus } from './types';
import { apiRequest, authHeader } from './http';

export const getMySupportTickets = (token: string) => apiRequest<SupportTicket[]>('/support/tickets/mine', { headers: authHeader(token) });
export const getSupportTicket = (token: string, id: string) => apiRequest<SupportTicket>(`/support/tickets/${id}`, { headers: authHeader(token) });
export const createSupportTicket = (token: string, input: { category: SupportTicketCategory; subject: string; description: string; attachments?: string[] }) => apiRequest<SupportTicket>('/support/tickets', { method: 'POST', headers: authHeader(token), body: JSON.stringify(input) });
export const getSupportMessages = (token: string, id: string) => apiRequest<SupportMessage[]>(`/support/tickets/${id}/messages`, { headers: authHeader(token) });
export const sendSupportMessage = (token: string, id: string, body: string, attachments: string[] = []) => apiRequest<SupportMessage>(`/support/tickets/${id}/messages`, { method: 'POST', headers: authHeader(token), body: JSON.stringify({ body, attachments }) });
export const confirmSupportResolved = (token: string, id: string) => apiRequest<SupportTicket>(`/support/tickets/${id}/confirm-resolved`, { method: 'POST', headers: authHeader(token) });
export const rateSupport = (token: string, id: string, rating: number, comment?: string) => apiRequest<SupportTicket>(`/support/tickets/${id}/rating`, { method: 'POST', headers: authHeader(token), body: JSON.stringify({ rating, comment }) });
export const getAdminSupportTickets = (token: string, params: Record<string, string> = {}) => apiRequest<PaginatedSupportTickets>(`/admin/support/tickets?${new URLSearchParams(params)}`, { headers: authHeader(token) });
export const updateSupportTicket = (token: string, id: string, input: { status?: SupportTicketStatus; priority?: SupportTicketPriority; assignedAgentUserId?: string }) => apiRequest<SupportTicket>(`/admin/support/tickets/${id}`, { method: 'PATCH', headers: authHeader(token), body: JSON.stringify(input) });
export const getCustomerSupportHistory = (token: string, id: string) => apiRequest<SupportTicket[]>(`/admin/support/tickets/${id}/history`, { headers: authHeader(token) });
