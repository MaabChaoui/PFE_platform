const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:8000/api'

export interface HealthResponse {
  status: string
  offline_mode: boolean
  indices_present: boolean
  dataset_present: boolean
  predictions_present: boolean
  llm: string
}

export async function getHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_BASE}/health`, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`)
  return res.json() as Promise<HealthResponse>
}
