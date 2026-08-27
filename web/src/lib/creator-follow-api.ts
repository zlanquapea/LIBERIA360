import { apiRequest, authHeader } from './http';

export interface CreatorFollowState {
  following: boolean;
  canFollow: boolean;
  followerCount: number;
}

export function getCreatorFollowState(token: string, creatorId: string): Promise<CreatorFollowState> {
  return apiRequest<CreatorFollowState>(`/creators/${creatorId}/follow`, {
    headers: authHeader(token),
  });
}

export function toggleCreatorFollow(token: string, creatorId: string): Promise<CreatorFollowState> {
  return apiRequest<CreatorFollowState>(`/creators/${creatorId}/follow`, {
    method: 'POST',
    headers: authHeader(token),
  });
}
