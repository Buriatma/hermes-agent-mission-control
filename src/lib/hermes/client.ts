// Hermes WebUI API Client - adapted for Mission Control

const API_BASE = '/api/hermes'

export interface SessionSummary {
  id: string
  source: string
  model: string | null
  title: string | null
  started_at: number
  ended_at: number | null
  message_count: number
  preview: string
}

export interface Message {
  id: number
  session_id: string
  role: string
  content: string | null
  timestamp: number
}

export async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`API error ${res.status}: ${body}`)
  }

  return res.json() as Promise<T>
}

export const api = {
  // Health
  health: () => request<{ status: string; online: boolean }>('/health'),
  
  // List requests as sessions
  sessions: (params?: { limit?: number }) =>
    request<{ requests: SessionSummary[] }>('/requests'),
  
  // Dispatch - create a new request
  dispatch: (data: { prompt: string; title?: string; kind?: string; sideEffecting?: boolean }) => 
    request<{ request: { id: string } }>('/dispatch', { method: 'POST', body: JSON.stringify(data) }),
  
  // Get request status
  requestStatus: (id: string) => request<{ request: { id: string; status: string; result: string; error: string | null } }>(`/requests/${id}`),
  
  // Stream request result
  streamRequest: (id: string) => 
    fetch(`${API_BASE}/requests/${id}/stream`).then(r => r.text()),
}
