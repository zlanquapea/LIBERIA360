import type { Review } from './types';
import { apiRequest, authHeader } from './http';

export interface CreateReviewInput {
  placeId: string;
  overallRating: number;
  comment?: string;
}

export function createReview(token: string, input: CreateReviewInput): Promise<Review> {
  return apiRequest<Review>('/reviews', {
    method: 'POST',
    headers: authHeader(token),
    body: JSON.stringify(input),
  });
}
