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

const COMMANDS = [
  { name: '/help', desc: 'Show available commands' },
  { name: '/status', desc: 'Check Hermes health' },
  { name: '/new', desc: 'Start new session' },
  { name: '/search', desc: 'Search sessions' },
  { name: '/cost', desc: 'Show cost breakdown' },
  { name: '/sessions', desc: 'List recent sessions' },
  { name: '/cron', desc: 'List cron jobs' },
  { name: '/brief', desc: 'Trigger daily briefing' },
  { name: '/clear', desc: 'Clear current chat' },
  { name: '/model', desc: 'Switch model' },
]

function timeAgo(ts: number) {
  const diff = Date.now() / 1000 - ts
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function formatTime(ts: number) {
  const d = new Date(ts * 1000)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (isToday) return time
  const month = d.toLocaleString([], { month: 'short' })
  const day = d.getDate()
  const year = d.getFullYear()
  const dateStr = year === now.getFullYear() ? `${month} ${day}` : `${month} ${day}, ${year}`
  return `${time} · ${dateStr}`
}

function formatSize(bytes?: number | null) {
  if (!bytes && bytes !== 0) return '—'
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let size = bytes
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++ }
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    user: 'bg-[#3b82f6]/20 text-[#60a5fa]',
    assistant: 'bg-[#10b981]/20 text-[#34d399]',
    tool: 'bg-[#f59e0b]/20 text-[#fbbf24]',
    system: 'bg-[#8b5cf6]/20 text-[#a78bfa]',
  }
  const labels: Record<string, string> = {
    user: 'YOU', assistant: 'HERMES', tool: 'TOOL', system: 'SYSTEM',
  }
  return <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold tracking-wide ${colors[role] || 'bg-white/10 text-white/50'}`}>{labels[role] || role.toUpperCase()}</span>
}

function SourceBadge({ source }: { source: string }) {
  return <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${SOURCE_COLORS[source] || '#94a3b8'}25`, color: SOURCE_COLORS[source] || '#94a3b8' }}>{source}</span>
}

function MessageContent({ content, role }: { content: string; role: string }) {
  if (!content) return null
  const lines = content.split('\n')
  return (
    <div className="text-[13px] leading-relaxed whitespace-pre-wrap break-words">
      {lines.map((line, i) => {
        if (line.startsWith('```')) return <pre key={i} className="text-[11px] font-mono bg-black/40 rounded-lg p-3 mt-2 overflow-x-auto border border-white/5"><code>{line.replace(/^```\w*/, '')}</code></pre>
        if (line.startsWith('> ')) return <blockquote key={i} className="border-l-2 border-[var(--accent)] pl-3 text-[var(--text-3)] italic my-1">{line.slice(2)}</blockquote>
        if (line.startsWith('- ')) return <div key={i} className="flex gap-2 ml-1 my-0.5"><span className="text-[var(--accent)]">•</span><span>{line.slice(2)}</span></div>
        if (line.match(/^\d+\.\s/)) return <div key={i} className="flex gap-2 ml-1 my-0.5"><span className="text-[var(--accent)]">{line.match(/^(\d+\.\s)/)?.[1]}</span><span>{line.replace(/^\d+\.\s/, '')}</span></div>
        return <span key={i}>{line}{i < lines.length - 1 ? <br /> : null}</span>
      })}
    </div>
  )
}

function TypingIndicator({ status }: { status: ReqStatus }) {
  const labels: Record<string, string> = {
    queued: 'Queued — waiting for Hermes...',
    running: 'Hermes is working...',
    '': 'Hermes thinking...',
  }
  return (
    <div className="flex justify-start">
      <div className="bg-[var(--surface-2)] border border-[var(--line)] rounded-2xl rounded-bl-md px-4 py-3">
        <div className="flex items-center gap-2.5">
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

function CommandPalette({ onSelect, onClose }: { onSelect: (cmd: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const filtered = COMMANDS.filter(c => c.name.startsWith(query.toLowerCase()) || c.desc.toLowerCase().includes(query.toLowerCase()))
  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 bg-[var(--surface-1)] border border-[var(--line)] rounded-xl shadow-2xl overflow-hidden z-50">
      <div className="p-2">
        <input
          autoFocus
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Type a command..."
          className="w-full px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--line)] text-sm text-[var(--text)] placeholder-[var(--text-3)] focus:outline-none focus:border-[var(--accent)]"
        />
      </div>
      <div className="max-h-48 overflow-y-auto">
        {filtered.map(cmd => (
          <button
            key={cmd.name}
            onClick={() => onSelect(cmd.name)}
            className="w-full text-left px-3 py-2 hover:bg-[var(--surface-2)] flex items-center gap-3 border-b border-[var(--line)] last:border-0"
          >
            <span className="text-xs font-mono text-[var(--accent)]">{cmd.name}</span>
            <span className="text-xs text-[var(--text-3)]">{cmd.desc}</span>
          </button>
        ))}
        {filtered.length === 0 && <p className="text-xs text-[var(--text-3)] px-3 py-2">No commands found</p>}
      </div>
    </div>
  )
}

function ModelSelector({ current, onChange }: { current: string | null; onChange: (m: string) => void }) {
  const [open, setOpen] = useState(false)
  const models = ['gemini-flash', 'gemini-2.5-flash', 'claude-3.5-sonnet', 'gpt-4o', 'best-long-context', 'best-coding']
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="text-[11px] px-2.5 py-1.5 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-[var(--text-3)] hover:text-[var(--text)] hover:border-[var(--accent)] transition-colors flex items-center gap-1.5"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
        {current || 'auto'}
        <span className="text-[8px]">▼</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full right-0 mb-2 bg-[var(--surface-1)] border border-[var(--line)] rounded-xl shadow-2xl overflow-hidden z-50 min-w-[180px]">
            {models.map(m => (
              <button
                key={m}
                onClick={() => { onChange(m); setOpen(false) }}
                className={`w-full text-left px-3 py-2 hover:bg-[var(--surface-2)] flex items-center justify-between ${m === current ? 'text-[var(--accent)]' : 'text-[var(--text-3)]'}`}
              >
                <span className="text-xs">{m}</span>
                {m === current && <span className="text-[10px]">✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
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
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showCommands, setShowCommands] = useState(false)
  const [model, setModel] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const sseRef = useRef<EventSource | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [autoScroll, setAutoScroll] = useState(true)
  const [replyingTo, setReplyingTo] = useState<Message | null>(null)

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

  // Auto-scroll
  useEffect(() => {
    if (autoScroll) {
      endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [messages, sending, autoScroll])

  // Detect manual scroll
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => {
      const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80
      setAutoScroll(atBottom)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  // Cleanup SSE
  useEffect(() => {
    return () => {
      if (sseRef.current) {
        sseRef.current.close()
        sseRef.current = null
      }
    }
  }, [])

  const connectSSE = useCallback((requestId: string) => {
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
      } catch { /* ignore */ }
    })

    es.addEventListener('result', (e) => {
      try {
        const d = JSON.parse(e.data)
        if (d.status === 'done' && d.result) {
          setSending(false)
          setReqStatus('done')
          setReplyingTo(null)
          loadSessions()
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
          setReplyingTo(null)
        }
      } catch { /* ignore */ }
    })

    es.addEventListener('done', () => {
      es.close()
      sseRef.current = null
    })

    es.onerror = () => {
      if (es.readyState === EventSource.CLOSED) {
        sseRef.current = null
      }
    }
  }, [loadSessions])

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    setShowCommands(false)
    setSending(true)
    setReqStatus('queued')
    setAutoScroll(true)

    // Handle slash commands locally
    if (text.startsWith('/')) {
      const cmd = text.split(' ')[0].toLowerCase()
      if (cmd === '/new') {
        setActiveId('')
        setMessages([])
        setSending(false)
        setReqStatus('')
        loadSessions()
        return
      }
      if (cmd === '/clear') {
        setMessages([])
        setSending(false)
        setReqStatus('')
        return
      }
      if (cmd === '/model') {
        const modelName = text.split(' ')[1] || 'gemini-flash'
        setModel(modelName)
        setSending(false)
        setReqStatus('')
        return
      }
    }

    try {
      const body: any = { prompt: text, title: text.slice(0, 60), kind: 'chat' }
      if (model) body.model = model
      if (replyingTo) {
        body.prompt = `[Replying to message ${replyingTo.id}]\n${text}`
        body.title = `Reply: ${text.slice(0, 50)}`
        setReplyingTo(null)
      }
      const res = await fetch('/api/hermes/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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
  }, [input, sending, loadSessions, connectSSE, model, replyingTo])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && document.activeElement !== inputRef.current) {
        e.preventDefault()
        setShowCommands(true)
      }
      if (e.key === 'Escape') {
        setShowCommands(false)
        setReplyingTo(null)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

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

  // Group consecutive messages by role
  const groupedMessages = messages.filter(m => m.role === 'user' || m.role === 'assistant').reduce<Message[][]>((groups, m, i) => {
    if (i === 0 || messages[i - 1].role !== m.role) groups.push([m])
    else groups[groups.length - 1].push(m)
    return groups
  }, [])

  return (
    <div className="flex h-[calc(100vh-3rem)] bg-[var(--bg)] text-[var(--text)] relative overflow-hidden">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sessions sidebar */}
      <div className={`fixed md:relative inset-y-0 left-0 z-50 md:z-auto w-80 md:w-72 border-r border-[var(--line)] flex flex-col bg-[var(--bg)] md:bg-transparent transform transition-transform duration-200 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="p-3 border-b border-[var(--line)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[var(--text-3)] uppercase tracking-wider">Sessions</span>
            <button onClick={() => { setActiveId(''); setMessages([]); setSidebarOpen(false); inputRef.current?.focus() }}
              className="text-[10px] px-2.5 py-1.5 rounded-lg bg-[var(--accent)] text-black font-semibold hover:opacity-90 active:scale-95 transition-all">
              + New
            </button>
          </div>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search..."
            className="w-full px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-sm text-[var(--text)] placeholder-[var(--text-3)] focus:outline-none focus:border-[var(--accent)] transition-colors" />
          <div className="flex gap-1 mt-2 flex-wrap">
            <button onClick={() => setSourceFilter('')}
              className={`text-[10px] px-2 py-1 rounded-full transition-all ${!sourceFilter ? 'bg-[var(--accent)] text-black font-semibold' : 'bg-[var(--surface-2)] text-[var(--text-3)] border border-[var(--line)] hover:border-[var(--accent)]'}`}>
              All
            </button>
            {sources.slice(0, 6).map(s => (
              <button key={s} onClick={() => setSourceFilter(sourceFilter === s ? '' : s)}
                className={`text-[10px] px-2 py-1 rounded-full capitalize transition-all ${sourceFilter === s ? 'text-white font-semibold' : 'bg-[var(--surface-2)] text-[var(--text-3)] border border-[var(--line)] hover:border-[var(--accent)]'}`}
                style={sourceFilter === s ? { backgroundColor: SOURCE_COLORS[s] || '#94a3b8' } : {}}>
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {loading && <div className="space-y-2 p-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-12 bg-[var(--surface-2)] rounded-lg animate-pulse" />)}</div>}
          {filtered.map(s => (
            <button key={s.id} onClick={() => { setActiveId(s.id); setSidebarOpen(false) }}
              className={`w-full text-left p-2.5 rounded-xl transition-all ${s.id === activeId ? 'bg-[var(--accent)]/15 border border-[var(--accent)]/50 shadow-sm' : 'hover:bg-[var(--surface-2)] border border-transparent'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium truncate">{s.title || s.preview?.slice(0, 40) || s.id.slice(0, 12)}</div>
                  <div className="flex gap-2 mt-1 text-[10px] text-[var(--text-3)] items-center flex-wrap">
                    <SourceBadge source={s.source} />
                    <span>{s.model || '?'}</span>
                    <span>{s.message_count} msgs</span>
                    <span>{timeAgo(s.last_active || s.started_at)}</span>
                  </div>
                </div>
                {s.ended_at ? (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/10 text-[var(--text-3)] shrink-0">ended</span>
                ) : s.last_active && (Date.now() / 1000 - s.last_active < 300) ? (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 shrink-0">active</span>
                ) : null}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header */}
        <div className="flex items-center gap-2 px-3 md:px-4 py-2.5 border-b border-[var(--line)] shrink-0 bg-[var(--bg)]/80 backdrop-blur-md z-10">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-[var(--text-3)] hover:text-[var(--text)] p-1.5 rounded-lg hover:bg-[var(--surface-2)] transition-all md:hidden">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
          </button>
          {activeSession ? (
            <>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold truncate">{activeSession.title || activeSession.id.slice(0, 12)}</h2>
                  <SourceBadge source={activeSession.source} />
                  {activeSession.model && <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--surface-2)] text-[var(--text-3)] border border-[var(--line)]">{activeSession.model}</span>}
                </div>
                <div className="flex gap-3 mt-0.5 text-[10px] text-[var(--text-3)]">
                  <span>{activeSession.message_count} msgs</span>
                  {totalTokens > 0 && <span>{(totalTokens / 1000).toFixed(1)}k tokens</span>}
                  {activeSession.estimated_cost_usd ? <span className="text-emerald-400">${activeSession.estimated_cost_usd.toFixed(4)}</span> : null}
                </div>
              </div>
              <ModelSelector current={model || activeSession.model} onChange={setModel} />
              <button onClick={() => { setActiveId(''); setMessages([]); inputRef.current?.focus() }}
                className="text-[10px] px-3 py-1.5 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-[var(--text-3)] hover:text-[var(--text)] hover:border-[var(--accent)] transition-all hidden md:block">
                New Chat
              </button>
            </>
          ) : (
            <div className="flex-1">
              <h2 className="text-sm font-semibold text-[var(--text-3)]">New conversation</h2>
            </div>
          )}
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 md:px-4 py-4 scroll-smooth">
          {msgLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="space-y-3 w-full max-w-2xl">
                {Array.from({ length: 3 }).map((_, i) => <div key={i} className={`h-16 bg-[var(--surface-2)] rounded-2xl animate-pulse ${i % 2 === 0 ? 'ml-auto' : 'mr-auto'} w-3/4`} />)}
              </div>
            </div>
          ) : messages.length === 0 && !sending ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center max-w-sm">
                <div className="text-5xl mb-4">💬</div>
                <p className="text-lg font-semibold text-[var(--text)] mb-1">Hermes Chat</p>
                <p className="text-sm text-[var(--text-3)] mb-4">Send a message or use <code className="text-[var(--accent)]">/</code> for commands</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {['Say hello', 'What can you do?', '/help', '/status'].map(s => (
                    <button key={s} onClick={() => { setInput(s); inputRef.current?.focus() }}
                      className="text-[11px] px-3 py-1.5 rounded-full bg-[var(--surface-2)] border border-[var(--line)] text-[var(--text-3)] hover:text-[var(--text)] hover:border-[var(--accent)] transition-all">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-1">
              {groupedMessages.map((group, gi) => {
                const isUser = group[0].role === 'user'
                const msg = group[0]
                return (
                  <div key={`${msg.id}-${gi}`} className={`flex ${isUser ? 'justify-end' : 'justify-start'} group`}>
                    <div className={`max-w-[85%] md:max-w-[75%] ${isUser ? 'order-2' : 'order-1'}`}>
                      {/* Avatar + name for assistant */}
                      {!isUser && (
                        <div className="flex items-center gap-2 mb-1 ml-1">
                          <div className="w-6 h-6 rounded-full bg-[var(--accent)]/20 border border-[var(--accent)]/40 flex items-center justify-center text-[10px] font-bold text-[var(--accent)]">H</div>
                          <span className="text-[11px] font-semibold text-[var(--text)]">Hermes</span>
                          <span className="text-[10px] text-[var(--text-3)]">{formatTime(msg.timestamp)}</span>
                        </div>
                      )}
                      <div className={`rounded-2xl px-3.5 py-2.5 ${
                        isUser
                          ? 'bg-[var(--accent)] text-black rounded-br-md shadow-lg shadow-[var(--accent)]/20'
                          : 'bg-[var(--surface-2)] border border-[var(--line)] rounded-bl-md'
                      }`}>
                        {/* User name + time */}
                        {isUser && (
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-[11px] font-semibold text-black/70">You</span>
                            <span className="text-[10px] text-black/50">{formatTime(msg.timestamp)}</span>
                          </div>
                        )}
                        {group.map(m => (
                          <div key={m.id}>
                            {m.content && <MessageContent content={m.content} role={m.role} />}
                            {!!m.tool_calls && (
                              <details className="mt-2">
                                <summary className="text-[10px] cursor-pointer text-[var(--accent)] hover:underline">Tool calls ({Array.isArray(m.tool_calls) ? (m.tool_calls as unknown[]).length : 1})</summary>
                                <pre className="text-[10px] mt-1 p-2 rounded-lg overflow-x-auto font-mono bg-black/30 max-h-48 overflow-y-auto border border-white/5">{JSON.stringify(m.tool_calls, null, 2)}</pre>
                              </details>
                            )}
                          </div>
                        ))}
                      </div>
                      {/* Hover actions */}
                      <div className={`flex gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity ${isUser ? 'justify-end' : 'justify-start'} ml-1`}>
                        <button onClick={() => { setInput(group.map(g => g.content || '').join('\n')); inputRef.current?.focus() }}
                          className="text-[10px] px-2 py-0.5 rounded-md hover:bg-[var(--surface-2)] text-[var(--text-3)] hover:text-[var(--text)] transition-all">
                          {isUser ? 'Edit' : 'Copy'}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
              {sending && <TypingIndicator status={reqStatus} />}
              <div ref={endRef} />
            </div>
          )}
        </div>

        {/* Reply bar */}
        {replyingTo && (
          <div className="px-3 md:px-4 py-2 bg-[var(--surface-1)] border-t border-[var(--line)] flex items-center justify-between">
            <div className="text-xs text-[var(--text-3)]">
              Replying to <span className="text-[var(--accent)]">#{replyingTo.id}</span>: {(replyingTo.content || '').slice(0, 60)}
            </div>
            <button onClick={() => setReplyingTo(null)} className="text-[var(--text-3)] hover:text-[var(--text)] text-xs">✕</button>
          </div>
        )}

        {/* Input area */}
        <div className="border-t border-[var(--line)] bg-[var(--bg)]/90 backdrop-blur-md shrink-0">
          <div className="max-w-3xl mx-auto p-3 md:p-4">
            {showCommands && (
              <CommandPalette
                onSelect={(cmd) => {
                  setShowCommands(false)
                  if (cmd === '/clear') {
                    setMessages([])
                    setSending(false)
                    setReqStatus('')
                    return
                  }
                  if (cmd === '/new') {
                    setActiveId('')
                    setMessages([])
                    setSending(false)
                    setReqStatus('')
                    loadSessions()
                    return
                  }
                  setInput(cmd + ' ')
                  inputRef.current?.focus()
                }}
                onClose={() => setShowCommands(false)}
              />
            )}
            <div className="flex gap-2 items-end">
              <div className="flex-1 relative">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => { setInput(e.target.value); if (e.target.value.startsWith('/')) setShowCommands(true) }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      sendMessage()
                    }
                    if (e.key === '/' && !e.metaKey && !e.ctrlKey && document.activeElement === inputRef.current) {
                      // Don't trigger if already typing slash
                    }
                  }}
                  onFocus={() => { if (input.startsWith('/')) setShowCommands(true) }}
                  onChange={e => { setInput(e.target.value); if (e.target.value.startsWith('/')) setShowCommands(true) }}
                  placeholder="Message Hermes... (/ for commands)"
                  rows={1}
                  className="w-full px-4 py-3 pr-10 rounded-2xl text-[13px] text-[var(--text)] bg-[var(--surface-1)] border border-[var(--line)] focus:outline-none focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)]/50 placeholder-[var(--text-3)] resize-none transition-all"
                  style={{ minHeight: '44px', maxHeight: '120px' }}
                />
                <button
                  onClick={() => setShowCommands(!showCommands)}
                  className="absolute right-3 bottom-2.5 text-[var(--text-3)] hover:text-[var(--accent)] text-xs font-mono transition-colors"
                >
                  /
                </button>
              </div>
              <button
                onClick={sendMessage}
                disabled={!input.trim() || sending}
                className="px-4 md:px-5 py-3 rounded-2xl text-[13px] font-semibold text-black bg-[var(--accent)] hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 shadow-lg shadow-[var(--accent)]/20">
                {sending ? (
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-black animate-bounce" />
                    <span className="w-1.5 h-1.5 rounded-full bg-black animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-black animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                ) : 'Send'}
              </button>
            </div>
            <div className="flex items-center justify-between mt-2 px-1">
              <div className="text-[10px] text-[var(--text-3)]">
                {model && <span className="text-[var(--accent)]">Model: {model}</span>}
              </div>
              <div className="text-[10px] text-[var(--text-3)]">
                Press <kbd className="px-1.5 py-0.5 rounded bg-[var(--surface-2)] border border-[var(--line)] text-[9px] font-mono">/</kbd> for commands
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
