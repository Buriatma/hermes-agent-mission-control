"use client"
import { useState, useEffect, useCallback, useRef } from 'react'

// ─── Types ─────────────────────────────────────────────
interface SessionSummary {
  id: string; source: string; model: string | null; title: string | null
  started_at: number; ended_at: number | null; end_reason: string | null
  message_count: number; tool_call_count: number
  input_tokens: number; output_tokens: number
  cache_read_tokens: number; cache_write_tokens: number; reasoning_tokens: number
  estimated_cost_usd: number | null; actual_cost_usd: number | null
  billing_provider: string | null; preview: string; last_active: number | null
}
interface Message {
  id: number; session_id: string; role: string; content: string | null
  tool_call_id: string | null; tool_calls: unknown; tool_name: string | null
  timestamp: number; token_count: number | null; finish_reason: string | null
}

// ─── Helpers ──────────────────────────────────────────
function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return String(n)
}
function timeAgo(ts: number): string {
  const diff = Date.now() / 1000 - ts
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}
const SOURCE_COLORS: Record<string, string> = {
  cli: '#06b6d4', telegram: '#38bdf8', discord: '#818cf8',
  whatsapp: '#25d366', buzz: '#f59e0b', web: '#a78bfa', webhook: '#94a3b8',
}

// ─── Components ───────────────────────────────────────
function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    user: '#3b82f6', assistant: '#22c55e', system: '#f59e0b', tool: '#a78bfa',
  }
  const color = colors[role] || '#94a3b8'
  return (
    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded"
      style={{ backgroundColor: `${color}22`, color }}>
      {role}
    </span>
  )
}
function CostBadge({ cost }: { cost: number | null }) {
  if (cost == null || cost === 0) return null
  return (
    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded"
      style={{ color: 'var(--accent)', backgroundColor: 'var(--accent)15' }}>
      ${cost.toFixed(4)}
    </span>
  )
}
function SourceBadge({ source }: { source: string }) {
  const bg = SOURCE_COLORS[source] || '#94a3b8'
  return (
    <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium"
      style={{ backgroundColor: bg, color: '#fff' }}>
      {source}
    </span>
  )
}

function tryFormatJson(text: string): string | null {
  const trimmed = text.trim()
  if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) return null
  try { return JSON.stringify(JSON.parse(trimmed), null, 2) } catch { return null }
}

function MessageContent({ content, role }: { content: string; role: string }) {
  const isToolResponse = role === 'tool'
  const isLong = content.length > 500

  if (isToolResponse) {
    const formatted = tryFormatJson(content)
    if (formatted) {
      if (isLong) return (
        <details className="mt-1">
          <summary className="text-xs cursor-pointer text-[var(--text-3)]">
            Tool response ({content.length.toLocaleString()} chars)
          </summary>
          <pre className="text-xs mt-1 p-2 rounded overflow-x-auto font-mono whitespace-pre-wrap bg-[var(--bg)] max-h-[400px] overflow-y-auto">
            {formatted}
          </pre>
        </details>
      )
      return <pre className="text-xs mt-1 p-2 rounded overflow-x-auto font-mono whitespace-pre-wrap bg-[var(--bg)]">{formatted}</pre>
    }
    if (isLong) return (
      <details className="mt-1">
        <summary className="text-xs cursor-pointer text-[var(--text-3)]">
          Tool response ({content.length.toLocaleString()} chars)
        </summary>
        <pre className="text-sm mt-1 p-2 rounded whitespace-pre-wrap break-words font-mono bg-[var(--bg)] max-h-[400px] overflow-y-auto">{content}</pre>
      </details>
    )
    return <pre className="text-xs mt-1 p-2 rounded whitespace-pre-wrap break-words font-mono bg-[var(--bg)]">{content}</pre>
  }

  if (isLong && content.length > 2000) return (
    <details className="mt-1" open>
      <summary className="text-xs cursor-pointer text-[var(--text-3)]">
        {content.length.toLocaleString()} chars
      </summary>
      <pre className="text-sm whitespace-pre-wrap break-words mt-1 font-sans leading-relaxed max-h-[600px] overflow-y-auto">{content}</pre>
    </details>
  )

  return <pre className="text-sm whitespace-pre-wrap break-words mt-1 font-sans leading-relaxed">{content}</pre>
}

function TokenStat({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  if (value === 0) return null
  return (
    <div className="text-center">
      <div className="text-[10px] text-[var(--text-3)]">{label}</div>
      <div className="text-sm font-semibold" style={{ color }}>{formatTokens(value)}</div>
      <div className="text-[10px] text-[var(--text-3)]">{((value / total) * 100).toFixed(0)}%</div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────
interface LocalMsg {
  id: string; role: 'user' | 'assistant' | 'pending'; content: string; ts: number
}

export default function ChatPage() {
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [activeId, setActiveId] = useState<string>('')
  const [messages, setMessages] = useState<Message[]>([])
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [msgLoading, setMsgLoading] = useState(false)
  const [sourceFilter, setSourceFilter] = useState('')
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [reqId, setReqId] = useState<string>('')

  const endRef = useRef<HTMLDivElement>(null)

  // Load sessions
  const loadSessions = useCallback(async () => {
    try {
      const qs = new URLSearchParams()
      if (sourceFilter) qs.set('source', sourceFilter)
      qs.set('limit', '100')
      const res = await fetch(`/api/hermes/sessions?${qs}`)
      if (res.ok) {
        const data = await res.json()
        setSessions(data.sessions || [])
      }
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [sourceFilter])

  useEffect(() => { loadSessions() }, [loadSessions])

  // Load messages for active session
  useEffect(() => {
    if (!activeId) return
    setMsgLoading(true)
    fetch(`/api/hermes/sessions/${activeId}`)
      .then(r => r.json())
      .then(d => { setMessages(d.messages || []); setMsgLoading(false) })
      .catch(() => setMsgLoading(false))
  }, [activeId])

  // Scroll to bottom
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [messages, sending])

  // Send a message via bridge dispatch + polling
  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    setSending(true)
    try {
      const res = await fetch('/api/hermes/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: text, title: text.slice(0, 60), kind: 'chat' }),
      })
      const d = await res.json()
      const id = d.request?.id
      if (!id) { setSending(false); return }
      setReqId(id)
      loadSessions()
      // Poll status until done
      const poll = setInterval(async () => {
        try {
          const r = await fetch(`/api/hermes/requests/${id}`)
          const dd = await r.json()
          const st = dd.request?.status
          if (st === 'done' || st === 'failed') {
            clearInterval(poll)
            setSending(false)
            const result = dd.request?.result || (st === 'failed' ? `Error: ${dd.request?.error}` : '')
            // Refresh sessions + messages
            loadSessions()
            if (activeId) {
              const mr = await fetch(`/api/hermes/sessions/${activeId}`)
              const md = await mr.json()
              setMessages(md.messages || [])
            } else {
              // auto-open latest session
              const sr = await fetch('/api/hermes/sessions?limit=1')
              const sd = await sr.json()
              if (sd.sessions?.[0]) setActiveId(sd.sessions[0].id)
            }
          }
        } catch (e) { console.error(e); clearInterval(poll); setSending(false) }
      }, 2500)
    } catch (e) { console.error(e); setSending(false) }
  }, [input, sending, activeId, loadSessions])

  const activeSession = sessions.find(s => s.id === activeId)
  const totalTokens = activeSession
    ? activeSession.input_tokens + activeSession.output_tokens + activeSession.cache_read_tokens + activeSession.cache_write_tokens + activeSession.reasoning_tokens
    : 0

  const sources = [...new Set(sessions.map(s => s.source).filter(Boolean))].sort()

  return (
    <div className="flex h-[calc(100vh-3rem)] bg-[var(--bg)] text-[var(--text)]">
      {/* ─── Sessions Sidebar ────────────────────────── */}
      <div className="w-72 border-r border-[var(--line)] flex flex-col shrink-0 max-md:hidden">
        <div className="p-3 border-b border-[var(--line)]">
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search sessions..."
            className="w-full px-3 py-1.5 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-sm text-[var(--text)] placeholder-[var(--text-3)] focus:outline-none focus:border-[var(--accent)]"
          />
          <div className="flex gap-1 mt-2 flex-wrap">
            <button onClick={() => setSourceFilter('')}
              className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${!sourceFilter ? 'bg-[var(--accent)] text-black' : 'bg-[var(--surface-2)] text-[var(--text-3)] border border-[var(--line)]'}`}>
              All
            </button>
            {sources.map(s => (
              <button key={s} onClick={() => setSourceFilter(s)}
                className={`text-[10px] px-2 py-0.5 rounded-full capitalize transition-colors ${sourceFilter === s ? 'text-white' : 'bg-[var(--surface-2)] text-[var(--text-3)] border border-[var(--line)]'}`}
                style={sourceFilter === s ? { backgroundColor: SOURCE_COLORS[s] || '#94a3b8' } : {}}>
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loading && <p className="text-xs text-[var(--text-3)] p-3">Loading...</p>}
          {sessions
            .filter(s => !search || (s.title || s.preview || s.id).toLowerCase().includes(search.toLowerCase()))
            .sort((a, b) => {
              const aT = a.last_active || a.started_at
              const bT = b.last_active || b.started_at
              return sortOrder === 'desc' ? bT - aT : aT - bT
            })
            .map(s => (
              <button key={s.id} onClick={() => setActiveId(s.id)}
                className={`w-full text-left p-2.5 rounded-lg transition-colors ${
                  s.id === activeId ? 'bg-[var(--accent)]15 border border-[var(--accent)]' : 'hover:bg-[var(--surface-2)]'
                }`}>
                <div className="flex justify-between items-start">
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium truncate">
                      {s.title || s.preview?.slice(0, 40) || s.id.slice(0, 12)}
                    </div>
                    <div className="flex gap-2 mt-0.5 text-[10px] text-[var(--text-3)] items-center flex-wrap">
                      <SourceBadge source={s.source} />
                      <span>{s.model || '?'}</span>
                      <span>{s.message_count} msgs</span>
                      <span>{timeAgo(s.started_at)}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 shrink-0 ml-1">
                    <CostBadge cost={s.estimated_cost_usd ?? s.actual_cost_usd} />
                    {s.ended_at ? (
                      <span className="text-[9px] px-1 py-0.5 rounded-full bg-white/10 text-[var(--text-3)]">ended</span>
                    ) : s.last_active && (Date.now() / 1000 - s.last_active < 300) ? (
                      <span className="text-[9px] px-1 py-0.5 rounded-full bg-green-500/20 text-green-400">active</span>
                    ) : null}
                  </div>
                </div>
              </button>
            ))}
        </div>
        <div className="p-2 border-t border-[var(--line)] flex items-center justify-between text-[10px] text-[var(--text-3)]">
          <span>{sessions.length} sessions</span>
          <button onClick={() => setSortOrder(p => p === 'desc' ? 'asc' : 'desc')}
            className="flex items-center gap-1 hover:text-[var(--text)]">
            <span style={{ transform: sortOrder === 'asc' ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', display: 'inline-block' }}>↓</span>
            {sortOrder === 'desc' ? 'Newest' : 'Oldest'}
          </button>
        </div>
      </div>

      {/* ─── Main Content ────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!activeId ? (
          <div className="flex-1 flex items-center justify-center text-[var(--text-3)]">
            <div className="text-center">
              <p className="text-lg">Select a session</p>
              <p className="text-sm mt-1">or send a message below to start a new one</p>
            </div>
          </div>
        ) : !activeSession ? (
          <div className="p-6 text-[var(--text-3)]">Loading...</div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-4xl mx-auto w-full">
              {/* Session Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-semibold">{activeSession.title || activeSession.id.slice(0, 12)}</h2>
                  <div className="flex gap-3 mt-1 text-xs text-[var(--text-3)]">
                    <SourceBadge source={activeSession.source} />
                    <span>{activeSession.model || 'unknown'}</span>
                    <span>{activeSession.message_count} msgs</span>
                    <span>{activeSession.tool_call_count} tools</span>
                    <span>{timeAgo(activeSession.started_at)}</span>
                  </div>
                </div>
                <CostBadge cost={activeSession.estimated_cost_usd ?? activeSession.actual_cost_usd} />
              </div>

              {/* Token Usage Bar */}
              {totalTokens > 0 && (
                <div className="rounded-lg border border-[var(--line)] p-4 bg-[var(--surface-1)]">
                  <h3 className="text-xs font-medium mb-3 text-[var(--text-3)]">Token Usage</h3>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <TokenStat label="Input" value={activeSession.input_tokens} total={totalTokens} color="#3b82f6" />
                    <TokenStat label="Output" value={activeSession.output_tokens} total={totalTokens} color="#22c55e" />
                    <TokenStat label="Cache Read" value={activeSession.cache_read_tokens} total={totalTokens} color="#f59e0b" />
                    <TokenStat label="Cache Write" value={activeSession.cache_write_tokens} total={totalTokens} color="var(--accent)" />
                    <TokenStat label="Reasoning" value={activeSession.reasoning_tokens} total={totalTokens} color="#c084fc" />
                  </div>
                  <div className="h-2 rounded-full mt-3 flex overflow-hidden bg-[var(--bg)]">
                    {activeSession.input_tokens > 0 && <div style={{ width: `${(activeSession.input_tokens / totalTokens) * 100}%`, backgroundColor: '#3b82f6' }} />}
                    {activeSession.output_tokens > 0 && <div style={{ width: `${(activeSession.output_tokens / totalTokens) * 100}%`, backgroundColor: '#22c55e' }} />}
                    {activeSession.cache_read_tokens > 0 && <div style={{ width: `${(activeSession.cache_read_tokens / totalTokens) * 100}%`, backgroundColor: '#f59e0b' }} />}
                    {activeSession.cache_write_tokens > 0 && <div style={{ width: `${(activeSession.cache_write_tokens / totalTokens) * 100}%`, backgroundColor: 'var(--accent)' }} />}
                    {activeSession.reasoning_tokens > 0 && <div style={{ width: `${(activeSession.reasoning_tokens / totalTokens) * 100}%`, backgroundColor: '#c084fc' }} />}
                  </div>
                </div>
              )}

              {/* Messages */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-[var(--text-3)]">
                    Messages {messages ? `(${messages.length})` : ''}
                  </h3>
                  <button onClick={() => setSortOrder(p => p === 'asc' ? 'desc' : 'asc')}
                    className="text-[10px] px-2 py-1 rounded flex items-center gap-1 bg-[var(--surface-1)] text-[var(--text-3)]">
                    {sortOrder === 'asc' ? '↑ Oldest first' : '↓ Newest first'}
                  </button>
                </div>
                {msgLoading && <p className="text-sm text-[var(--text-3)]">Loading messages...</p>}
                {(sortOrder === 'desc' ? [...messages].reverse() : messages).map(m => (
                  <div key={m.id} className="rounded-lg border border-[var(--line)] p-3 bg-[var(--surface-1)]">
                    <div className="flex items-center gap-2 mb-1">
                      <RoleBadge role={m.role} />
                      {m.tool_name && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--bg)] text-amber-400">
                          {m.tool_name}
                        </span>
                      )}
                      <span className="text-[10px] ml-auto text-[var(--text-3)]">
                        {new Date(m.timestamp * 1000).toLocaleTimeString()}
                      </span>
                    </div>
                    {m.content && <MessageContent content={m.content} role={m.role} />}
                    {!!m.tool_calls && (
                      <details className="mt-2">
                        <summary className="text-[10px] cursor-pointer text-[var(--accent)]">
                          Tool calls ({Array.isArray(m.tool_calls) ? (m.tool_calls as unknown[]).length : 1})
                        </summary>
                        <pre className="text-[10px] mt-1 p-2 rounded overflow-x-auto font-mono bg-[var(--bg)]">
                          {JSON.stringify(m.tool_calls, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                ))}
                {sending && (
                  <div className="rounded-lg border border-[var(--accent)]/40 p-3 bg-[var(--surface-1)]">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
                      <span className="text-[13px] text-[var(--accent)]">Hermes processing... <span className="text-[var(--text-3)]">(request {reqId.slice(-6)})</span></span>
                    </div>
                  </div>
                )}
                <div ref={endRef} />
              </div>
            </div>

            {/* Input bar */}
            <div className="border-t border-[var(--line)] p-3 max-w-4xl mx-auto w-full">
              <div className="flex gap-2">
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                  placeholder="Message Hermes... (Enter to send)"
                  className="flex-1 rounded-lg px-4 py-2.5 text-[13px] text-[var(--text)] bg-[var(--surface-1)] border border-[var(--line)] focus:outline-none focus:border-[var(--accent)]"
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || sending}
                  className="px-5 py-2 rounded-lg text-[13px] font-medium text-black bg-[var(--accent)] hover:opacity-90 disabled:opacity-40"
                >
                  Send
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}