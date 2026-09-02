// Admin CRUD + the one customer-facing mutation (article feedback) for
// the Help Center — public reads live in lib/api.ts alongside the rest of
// the catalog, same split as everywhere else in this app.
import type {
  ArticleFeedbackSummary,
  ArticleStatus,
  KnowledgeArticle,
  KnowledgeCategory,
  PaginatedKnowledgeArticles,
} from "./types";
import { apiRequest, authHeader } from "./http";

export const submitArticleFeedback = (id: string, helpful: boolean) =>
  apiRequest<{ success: true }>(`/help-center/articles/${id}/feedback`, {
    method: "POST",
    body: JSON.stringify({ helpful }),
  });

export const getAdminHelpCenterCategories = (token: string) =>
  apiRequest<KnowledgeCategory[]>("/admin/help-center/categories", {
    headers: authHeader(token),
  });

export const createHelpCenterCategory = (
  token: string,
  input: { name: string; description?: string; sortOrder?: number },
) =>
  apiRequest<KnowledgeCategory>("/admin/help-center/categories", {
    method: "POST",
    headers: authHeader(token),
    body: JSON.stringify(input),
  });

export const updateHelpCenterCategory = (
  token: string,
  id: string,
  input: { name?: string; description?: string; sortOrder?: number },
) =>
  apiRequest<KnowledgeCategory>(`/admin/help-center/categories/${id}`, {
    method: "PATCH",
    headers: authHeader(token),
    body: JSON.stringify(input),
  });

export const deleteHelpCenterCategory = (token: string, id: string) =>
  apiRequest<{ success: true }>(`/admin/help-center/categories/${id}`, {
    method: "DELETE",
    headers: authHeader(token),
  });

export const getAdminHelpCenterArticles = (
  token: string,
  params: Record<string, string> = {},
) =>
  apiRequest<PaginatedKnowledgeArticles>(
    `/admin/help-center/articles?${new URLSearchParams(params)}`,
    { headers: authHeader(token) },
  );

export const getAdminHelpCenterArticle = (token: string, id: string) =>
  apiRequest<KnowledgeArticle>(`/admin/help-center/articles/${id}`, {
    headers: authHeader(token),
  });

export const getArticleFeedbackSummary = (token: string, id: string) =>
  apiRequest<ArticleFeedbackSummary>(`/admin/help-center/articles/${id}/feedback-summary`, {
    headers: authHeader(token),
  });

export interface HelpCenterArticleInput {
  categoryId: string;
  title: string;
  content: string;
  status?: ArticleStatus;
}

export const createHelpCenterArticle = (token: string, input: HelpCenterArticleInput) =>
  apiRequest<KnowledgeArticle>("/admin/help-center/articles", {
    method: "POST",
    headers: authHeader(token),
    body: JSON.stringify(input),
  });

export const updateHelpCenterArticle = (
  token: string,
  id: string,
  input: Partial<HelpCenterArticleInput>,
) =>
  apiRequest<KnowledgeArticle>(`/admin/help-center/articles/${id}`, {
    method: "PATCH",
    headers: authHeader(token),
    body: JSON.stringify(input),
  });

export const deleteHelpCenterArticle = (token: string, id: string) =>
  apiRequest<{ success: true }>(`/admin/help-center/articles/${id}`, {
    method: "DELETE",
    headers: authHeader(token),
  });
