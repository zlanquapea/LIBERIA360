import type { Review } from './types';
import { apiRequest, authHeader } from './http';

// Exactly one of placeId/creatorId — see the Review type's doc comment.
export interface CreateReviewInput {
  placeId?: string;
  creatorId?: string;
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
