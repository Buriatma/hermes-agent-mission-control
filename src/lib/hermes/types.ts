export interface SessionSummary {
  id: string
  source: string
  model: string | null
  title: string | null
  started_at: number
  ended_at: number | null
  end_reason: string | null
  message_count: number
  tool_call_count: number
  input_tokens: number
  output_tokens: number
  cache_read_tokens: number
  cache_write_tokens: number
  reasoning_tokens: number
  estimated_cost_usd: number | null
  actual_cost_usd: number | null
  billing_provider: string | null
  preview: string
  last_active: number | null
}

export interface Message {
  id: number
  session_id: string
  role: string
  content: string | null
  tool_call_id?: string | null
  tool_calls?: unknown
  tool_name?: string | null
  timestamp: number
  token_count?: number | null
  finish_reason?: string | null
}

export interface SessionStats {
  total_sessions: number
  total_messages: number
  total_estimated_cost_usd: number
  sessions_by_source: Record<string, number>
  sessions_by_model: Record<string, number>
}

export interface WSEvent {
  type: string
  data?: Record<string, unknown>
  timestamp: number
}
