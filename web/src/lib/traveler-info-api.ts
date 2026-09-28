import type { TravelerInfoSettings } from './types';
import { apiRequest, authHeader } from './http';

// GET is public — every field renders nothing on /travel-info until an
// admin sets it (see TravelerInfoSettings' doc comment).
export function getTravelerInfo(): Promise<TravelerInfoSettings> {
  return apiRequest<TravelerInfoSettings>('/traveler-info');
}

export interface UpdateTravelerInfoInput {
  usdToLrdRate?: number;
  visaInfo?: string;
  entryRequirements?: string;
  currentSeasonNote?: string;
}

// Plain admin, not super-admin — see TravelerInfoController's doc comment.
export function updateTravelerInfo(
  token: string,
  input: UpdateTravelerInfoInput,
): Promise<TravelerInfoSettings> {
  return apiRequest<TravelerInfoSettings>('/traveler-info', {
    method: 'PATCH',
    headers: authHeader(token),
    body: JSON.stringify(input),
  });
}
