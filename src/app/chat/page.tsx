"use client"
import { useState, useEffect, useCallback, useRef } from 'react'

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
  tool_name: string | null; tool_calls: unknown; timestamp: number
}

type ReqStatus = '' | 'queued' | 'running' | 'done' | 'failed'

const SOURCE_COLORS: Record<string, string> = {
  telegram: '#0088cc', buzz: '#00ff88', cli: '#f59e0b', api_server: '#8b5cf6',
  subagent: '#ef4444', tui: '#06b6d4', webui: '#ec4899', desktop: '#10b981',
}

function timeAgo(ts: number) {
  const diff = Date.now() / 1000 - ts
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    user: 'bg-blue-500/20 text-blue-400', assistant: 'bg-emerald-500/20 text-emerald-400',
    tool: 'bg-amber-500/20 text-amber-400', system: 'bg-purple-500/20 text-purple-400',
  }
  return <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${colors[role] || 'bg-white/10 text-white/50'}`}>{role}</span>
}

function CostBadge({ cost }: { cost: number | null | undefined }) {
  if (!cost || cost <= 0) return null
  return <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">${cost.toFixed(4)}</span>
}

function SourceBadge({ source }: { source: string }) {
  return <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${SOURCE_COLORS[source] || '#94a3b8'}30`, color: SOURCE_COLORS[source] || '#94a3b8' }}>{source}</span>
}

function MessageContent({ content, role }: { content: string; role: string }) {
  if (!content) return null
  const isUser = role === 'user'
  const lines = content.split('\n')
  return (
    <div className={`text-[13px] leading-relaxed whitespace-pre-wrap break-words ${isUser ? '' : 'prose prose-invert prose-sm max-w-none'}`}>
      {lines.map((line, i) => {
        if (line.startsWith('```')) return <pre key={i} className="text-[11px] font-mono bg-black/30 rounded p-1 mt-1"><code>{line.replace(/^```\w*/, '')}</code></pre>
        if (line.startsWith('> ')) return <blockquote key={i} className="border-l-2 border-[var(--accent)] pl-2 text-[var(--text-3)] italic">{line.slice(2)}</blockquote>
        if (line.startsWith('- ')) return <div key={i} className="flex gap-1.5 ml-2"><span className="text-[var(--accent)]">•</span><span>{line.slice(2)}</span></div>
        return <span key={i}>{line}{i < lines.length - 1 ? <br /> : null}</span>
      })}
    </div>
  )
}

/** Typing indicator with status-specific text */
function TypingIndicator({ status }: { status: ReqStatus }) {
  const labels: Record<string, string> = {
    queued: 'Queued — waiting for Hermes...',
    running: 'Hermes is working...',
    '': 'Hermes thinking...',
  }
  return (
    <div className="flex justify-start">
      <div className="bg-[var(--surface-2)] border border-[var(--line)] rounded-2xl rounded-bl-md px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="flex gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-bounce" style={{ animationDelay: '300ms' }} />
          </span>
          <span className="text-[12px] text-[var(--text-3)]">{labels[status] || labels['']}</span>
        </div>
      </div>
    </div>
  )
}

export default function ChatPage() {
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [activeId, setActiveId] = useState<string>('')
  const [messages, setMessages] = useState<Message[]>([])
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [msgLoading, setMsgLoading] = useState(false)
  const [sourceFilter, setSourceFilter] = useState('')
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [reqId, setReqId] = useState<string>('')
  const [reqStatus, setReqStatus] = useState<ReqStatus>('')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const sseRef = useRef<EventSource | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)

  const loadSessions = useCallback(async () => {
    try {
      const qs = new URLSearchParams()
      if (sourceFilter) qs.set('source', sourceFilter)
      qs.set('limit', '200')
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
    if (!activeId) { setMessages([]); return }
    setMsgLoading(true)
    fetch(`/api/hermes/sessions/${activeId}`)
      .then(r => r.json())
      .then(d => { setMessages(d.messages || []); setMsgLoading(false) })
      .catch(() => setMsgLoading(false))
  }, [activeId])

  // Auto-scroll when new messages arrive or during sending
  useEffect(() => {
    if (autoScroll) {
      endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [messages, sending, autoScroll])

  // Detect manual scroll to disable auto-scroll
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60
      setAutoScroll(atBottom)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  // Cleanup SSE on unmount
  useEffect(() => {
    return () => {
      if (sseRef.current) {
        sseRef.current.close()
        sseRef.current = null
      }
    }
  }, [])

  const connectSSE = useCallback((requestId: string) => {
    // Close any existing connection
    if (sseRef.current) {
      sseRef.current.close()
      sseRef.current = null
    }

    const es = new EventSource(`/api/hermes/requests/${requestId}/stream`)
    sseRef.current = es

    es.addEventListener('status', (e) => {
      try {
        const d = JSON.parse(e.data)
        setReqStatus(d.status || '')
      } catch { /* ignore parse errors */ }
    })

    es.addEventListener('result', (e) => {
      try {
        const d = JSON.parse(e.data)
        if (d.status === 'done' && d.result) {
          // Result received — fetch updated messages
          setSending(false)
          setReqStatus('done')
          loadSessions()
          // Find and load the latest session
          fetch('/api/hermes/sessions?limit=1')
            .then(r => r.json())
            .then(sd => {
              const latest = sd.sessions?.[0]
              if (latest) {
                setActiveId(latest.id)
                fetch(`/api/hermes/sessions/${latest.id}`)
                  .then(r => r.json())
                  .then(md => {
                    setMessages(md.messages || [])
                    setAutoScroll(true)
                  })
              }
            })
        } else if (d.status === 'failed') {
          setSending(false)
          setReqStatus('failed')
          loadSessions()
        }
      } catch { /* ignore */ }
    })

    es.addEventListener('done', () => {
      es.close()
      sseRef.current = null
    })

    es.onerror = () => {
      // EventSource auto-reconnects. If it gives up, close and rely on
      // the next SSE event cycle.
      if (es.readyState === EventSource.CLOSED) {
        sseRef.current = null
      }
    }
  }, [loadSessions])

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    setSending(true)
    setReqStatus('queued')
    setAutoScroll(true)

    try {
      const res = await fetch('/api/hermes/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: text, title: text.slice(0, 60), kind: 'chat' }),
      })
      const d = await res.json()
      const id = d.request?.id
      if (!id) { setSending(false); setReqStatus(''); return }
      setReqId(id)
      loadSessions()
      connectSSE(id)
    } catch (e) {
      console.error(e)
      setSending(false)
      setReqStatus('')
    }
  }, [input, sending, loadSessions, connectSSE])

  const activeSession = sessions.find(s => s.id === activeId)
  const totalTokens = activeSession ? (activeSession.input_tokens + activeSession.output_tokens + activeSession.cache_read_tokens + activeSession.cache_write_tokens + activeSession.reasoning_tokens) : 0

  const sources = [...new Set(sessions.map(s => s.source).filter(Boolean))].sort()
  const filtered = sessions
    .filter(s => !search || (s.title || s.preview || s.id).toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const aT = a.last_active || a.started_at
      const bT = b.last_active || b.started_at
      return sortOrder === 'desc' ? bT - aT : aT - bT
    })

  return (
    <div className="flex h-[calc(100vh-3rem)] bg-[var(--bg)] text-[var(--text)]">
      {/* Sessions sidebar */}
      {sidebarOpen && (
        <div className="w-72 border-r border-[var(--line)] flex flex-col shrink-0 max-md:absolute max-md:z-50 max-md:h-full max-md:bg-[var(--bg)]">
          <div className="p-3 border-b border-[var(--line)]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-[var(--text-3)]">Sessions ({filtered.length})</span>
              <button onClick={() => { setActiveId(''); setMessages([]); inputRef.current?.focus() }}
                className="text-[10px] px-2 py-1 rounded bg-[var(--accent)] text-black hover:opacity-80">
                + New
              </button>
            </div>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search..."
              className="w-full px-3 py-1.5 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-sm text-[var(--text)] placeholder-[var(--text-3)] focus:outline-none focus:border-[var(--accent)]" />
            <div className="flex gap-1 mt-2 flex-wrap">
              <button onClick={() => setSourceFilter('')}
                className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${!sourceFilter ? 'bg-[var(--accent)] text-black' : 'bg-[var(--surface-2)] text-[var(--text-3)] border border-[var(--line)]'}`}>
                All
              </button>
              {sources.map(s => (
                <button key={s} onClick={() => setSourceFilter(sourceFilter === s ? '' : s)}
                  className={`text-[10px] px-2 py-0.5 rounded-full capitalize transition-colors ${sourceFilter === s ? 'text-white' : 'bg-[var(--surface-2)] text-[var(--text-3)] border border-[var(--line)]'}`}
                  style={sourceFilter === s ? { backgroundColor: SOURCE_COLORS[s] || '#94a3b8' } : {}}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {loading && <p className="text-xs text-[var(--text-3)] p-3">Loading...</p>}
            {filtered.map(s => (
              <button key={s.id} onClick={() => { setActiveId(s.id); if (window.innerWidth < 768) setSidebarOpen(false) }}
                className={`w-full text-left p-2.5 rounded-lg transition-colors ${s.id === activeId ? 'bg-[var(--accent)]/15 border border-[var(--accent)]/50' : 'hover:bg-[var(--surface-2)]'}`}>
                <div className="text-[13px] font-medium truncate">{s.title || s.preview?.slice(0, 40) || s.id.slice(0, 12)}</div>
                <div className="flex gap-2 mt-0.5 text-[10px] text-[var(--text-3)] items-center flex-wrap">
                  <SourceBadge source={s.source} />
                  <span>{s.model || '?'}</span>
                  <span>{s.message_count} msgs</span>
                  <span>{timeAgo(s.last_active || s.started_at)}</span>
                  <CostBadge cost={s.estimated_cost_usd ?? s.actual_cost_usd} />
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header bar */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--line)] shrink-0">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-[var(--text-3)] hover:text-[var(--text)] text-lg">
            {sidebarOpen ? '◀' : '▶'}
          </button>
          {activeSession ? (
            <div className="flex items-center gap-3 min-w-0">
              <h2 className="text-sm font-semibold truncate">{activeSession.title || activeSession.id.slice(0, 12)}</h2>
              <SourceBadge source={activeSession.source} />
              <span className="text-[11px] text-[var(--text-3)]">{activeSession.model}</span>
              <span className="text-[11px] text-[var(--text-3)]">{activeSession.message_count} msgs</span>
              <CostBadge cost={activeSession.estimated_cost_usd ?? activeSession.actual_cost_usd} />
            </div>
          ) : (
            <span className="text-sm text-[var(--text-3)]">New conversation</span>
          )}
          <button onClick={() => { setActiveId(''); setMessages([]); inputRef.current?.focus() }}
            className="ml-auto text-[10px] px-3 py-1.5 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-[var(--text-3)] hover:text-[var(--text)]">
            ✚ New
          </button>
        </div>

        {/* Token stats bar (when session selected) */}
        {activeSession && totalTokens > 0 && (
          <div className="px-4 py-1.5 border-b border-[var(--line)] text-[10px] text-[var(--text-3)] flex items-center gap-3 shrink-0">
            <span>Total: {totalTokens.toLocaleString()}</span>
            <span className="text-blue-400">In: {activeSession.input_tokens.toLocaleString()}</span>
            <span className="text-green-400">Out: {activeSession.output_tokens.toLocaleString()}</span>
            {activeSession.cache_read_tokens > 0 && <span className="text-amber-400">Cache: {activeSession.cache_read_tokens.toLocaleString()}</span>}
            {activeSession.reasoning_tokens > 0 && <span className="text-purple-400">Reason: {activeSession.reasoning_tokens.toLocaleString()}</span>}
          </div>
        )}

        {/* Messages area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
          {msgLoading ? (
            <div className="flex items-center justify-center h-full text-[var(--text-3)]">
              <span className="animate-pulse">Loading messages...</span>
            </div>
          ) : messages.length === 0 && !sending ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-2xl mb-2">🤖</p>
                <p className="text-lg font-medium text-[var(--text-3)]">Hermes OS</p>
                <p className="text-sm text-[var(--text-3)] mt-1">Type a message to start chatting</p>
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-3">
              {messages.filter(m => m.role === 'user' || m.role === 'assistant').map(m => (
                <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                    m.role === 'user'
                      ? 'bg-[var(--accent)] text-black rounded-br-md'
                      : 'bg-[var(--surface-2)] border border-[var(--line)] rounded-bl-md'
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      {m.role !== 'user' && <RoleBadge role={m.role} />}
                      {m.tool_name && <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--bg)] text-amber-400">{m.tool_name}</span>}
                      <span className={`text-[10px] ml-auto ${m.role === 'user' ? 'text-black/50' : 'text-[var(--text-3)]'}`}>
                        {new Date(m.timestamp * 1000).toLocaleTimeString()}
                      </span>
                    </div>
                    {m.content && <MessageContent content={m.content} role={m.role} />}
                    {!!m.tool_calls && (
                      <details className="mt-2">
                        <summary className="text-[10px] cursor-pointer text-[var(--accent)]">
                          Tool calls ({Array.isArray(m.tool_calls) ? (m.tool_calls as unknown[]).length : 1})
                        </summary>
                        <pre className="text-[10px] mt-1 p-2 rounded overflow-x-auto font-mono bg-black/20 max-h-48 overflow-y-auto">
                          {JSON.stringify(m.tool_calls, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              ))}
              {sending && <TypingIndicator status={reqStatus} />}
              <div ref={endRef} />
            </div>
          )}
        </div>

        {/* Input bar — ALWAYS visible */}
        <div className="border-t border-[var(--line)] p-3 shrink-0">
          <div className="flex gap-2 max-w-3xl mx-auto">
            <input ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
              placeholder={activeSession ? `Reply to ${activeSession.title?.slice(0, 30) || 'session'}...` : 'Message Hermes... (Enter to send)'}
              className="flex-1 rounded-lg px-4 py-2.5 text-[13px] text-[var(--text)] bg-[var(--surface-1)] border border-[var(--line)] focus:outline-none focus:border-[var(--accent)] placeholder-[var(--text-3)]"
            />
            <button onClick={sendMessage}
              disabled={!input.trim() || sending}
              className="px-5 py-2 rounded-lg text-[13px] font-medium text-black bg-[var(--accent)] hover:opacity-90 disabled:opacity-40 transition-opacity">
              {sending ? '...' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
