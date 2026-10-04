import { HealthResponse } from '@truelinks/shared';

export async function getHealth(): Promise<HealthResponse> {
  const res = await fetch('/api/health');
  if (!res.ok) {
    throw new Error(`Failed to fetch health: ${res.status} ${res.statusText}`);
  }
  const json = await res.json();
  return HealthResponse.parse(json);
}
