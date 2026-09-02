import type { BlogPost, BlogPostStatus, PaginatedBlogPosts } from "./types";
import { apiRequest, authHeader } from "./http";

export interface BlogPostInput {
  title: string;
  content: string;
  coverImage?: string | null;
  status?: BlogPostStatus;
}

export const getAdminBlogPosts = (token: string, params: Record<string, string> = {}) =>
  apiRequest<PaginatedBlogPosts>(`/admin/blog?${new URLSearchParams(params)}`, {
    headers: authHeader(token),
  });

export const getAdminBlogPost = (token: string, id: string) =>
  apiRequest<BlogPost>(`/admin/blog/${id}`, { headers: authHeader(token) });

export const createBlogPost = (token: string, input: BlogPostInput) =>
  apiRequest<BlogPost>("/admin/blog", {
    method: "POST",
    headers: authHeader(token),
    body: JSON.stringify(input),
  });

export const updateBlogPost = (token: string, id: string, input: Partial<BlogPostInput>) =>
  apiRequest<BlogPost>(`/admin/blog/${id}`, {
    method: "PATCH",
    headers: authHeader(token),
    body: JSON.stringify(input),
  });

export const deleteBlogPost = (token: string, id: string) =>
  apiRequest<{ success: true }>(`/admin/blog/${id}`, {
    method: "DELETE",
    headers: authHeader(token),
  });
