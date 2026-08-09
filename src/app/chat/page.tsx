"use client"
import { useState, useEffect, useCallback, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import {
  MessageSquare, Plus, Search, Trash2, Edit3, Copy, MoreVertical,
  ChevronDown, Send, Paperclip, Mic, Check, CheckCheck,
  AlertCircle, Loader2, X, Settings, HelpCircle, Terminal,
  Zap, Clock, ArrowLeft, Star, Archive, Pin, Volume2
} from 'lucide-react'

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
  { name: '/help', desc: 'Show commands', icon: HelpCircle },
  { name: '/new', desc: 'New conversation', icon: Plus },
  { name: '/clear', desc: 'Clear chat', icon: Trash2 },
  { name: '/model', desc: 'Switch model', icon: Terminal },
  { name: '/status', desc: 'System status', icon: Zap },
  { name: '/search', desc: 'Search history', icon: Search },
  { name: '/brief', desc: 'Daily briefing', icon: Clock },
  { name: '/cost', desc: 'Usage & cost', icon: Archive },
]

function timeAgo(ts: number) {
  const diff = Date.now() / 1000 - ts
  if (diff < 60) return 'now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}d`
}

function formatTime(ts: number) {
  const d = new Date(ts * 1000)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (isToday) return time
  const month = d.toLocaleString([], { month: 'short' })
  const day = d.getDate()
  return `${time} · ${month} ${day}`
}

function getAvatarClass(source: string) {
  const map: Record<string, string> = {
    telegram: 'avatar-gradient-1', buzz: 'avatar-gradient-2', cli: 'avatar-gradient-3',
    api_server: 'avatar-gradient-4', subagent: 'avatar-gradient-5', tui: 'avatar-gradient-1',
    webui: 'avatar-gradient-2', desktop: 'avatar-gradient-3',
  }
  return map[source] || 'avatar-gradient-1'
}

function getInitial(text: string) {
  return (text || 'H').slice(0, 1).toUpperCase()
}

function SourceBadge({ source }: { source: string }) {
  return <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${SOURCE_COLORS[source] || '#94a3b8'}20`, color: SOURCE_COLORS[source] || '#94a3b8' }}>{source}</span>
}

function TypingIndicator({ status }: { status: ReqStatus }) {
  const labels: Record<string, string> = {
    queued: 'Queued - waiting...', running: 'Working...', '': 'Thinking...',
  }
  return (
    <div className="flex justify-start msg-in">
      <div className="flex items-center gap-3 bg-[var(--surface-2)] border border-[var(--line)] rounded-2xl rounded-bl-md px-4 py-3 glow-pulse">
        <div className="w-7 h-7 rounded-full avatar-gradient-1 flex items-center justify-center text-[11px] font-bold text-black shrink-0">H</div>
        <div className="flex gap-1.5">
          <span className="typing-dot" style={{ animationDelay: '0ms' }} />
          <span className="typing-dot" style={{ animationDelay: '200ms' }} />
          <span className="typing-dot" style={{ animationDelay: '400ms' }} />
        </div>
        <span className="text-[11px] text-[var(--text-3)] ml-1">{labels[status] || labels['']}</span>
      </div>
    </div>
  )
}

function MessageContent({ content, role }: { content: string; role: string }) {
  if (!content) return null
  const isUser = role === 'user'
  if (isUser) {
    return <div className="text-[13px] leading-relaxed whitespace-pre-wrap break-words">{content}</div>
  }
  return (
    <div className="text-[13px] leading-relaxed break-words markdown-body">
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
        {content}
      </ReactMarkdown>
    </div>
  )
}

function CommandPalette({ onSelect, onClose }: { onSelect: (cmd: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const filtered = COMMANDS.filter(c => c.name.startsWith(query.toLowerCase()) || c.desc.toLowerCase().includes(query.toLowerCase()))
  return (
    <div className="absolute bottom-full left-0 right-0 mb-2 bg-[var(--surface-1)] border border-[var(--line)] rounded-xl shadow-2xl shadow-black/40 overflow-hidden z-50 glass fade-in-up">
      <div className="p-2">
        <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Type a command..."
          className="w-full px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--line)] text-sm text-[var(--text)] placeholder-[var(--text-3)] focus:outline-none focus:border-[var(--accent)] transition-colors" />
      </div>
      <div className="max-h-48 overflow-y-auto">
        {filtered.map(cmd => {
          const Icon = cmd.icon
          return (
            <button key={cmd.name} onClick={() => onSelect(cmd.name)}
              className="w-full text-left px-3 py-2.5 hover:bg-[var(--accent)]/10 flex items-center gap-3 border-b border-[var(--line)] last:border-0 transition-all group">
              <Icon className="w-4 h-4 text-[var(--text-3)] group-hover:text-[var(--accent)]" />
              <span className="text-[11px] font-mono text-[var(--accent)] font-semibold min-w-[60px]">{cmd.name}</span>
              <span className="text-[11px] text-[var(--text-3)] group-hover:text-[var(--text-2)] transition-colors">{cmd.desc}</span>
            </button>
          )
        })}
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
      <button onClick={() => setOpen(!open)}
        className="text-[11px] px-3 py-1.5 rounded-full bg-[var(--surface-2)] border border-[var(--line)] text-[var(--text-3)] hover:text-[var(--accent)] hover:border-[var(--accent)]/50 transition-all flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
        {current || 'auto'}
        <ChevronDown className="w-2.5 h-2.5" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute bottom-full right-0 mb-2 bg-[var(--surface-1)] border border-[var(--line)] rounded-xl shadow-2xl shadow-black/40 overflow-hidden z-50 min-w-[200px] glass fade-in-up">
            <div className="p-1.5 border-b border-[var(--line)]">
              <span className="text-[10px] text-[var(--text-3)] px-2 font-semibold uppercase tracking-wider">Model</span>
            </div>
            {models.map(m => (
              <button key={m} onClick={() => { onChange(m); setOpen(false) }}
                className={`w-full text-left px-3 py-2 flex items-center justify-between transition-all ${m === current ? 'text-[var(--accent)] bg-[var(--accent)]/10' : 'text-[var(--text-3)] hover:bg-[var(--surface-2)]'}`}>
                <span className="text-[12px] font-mono">{m}</span>
                {m === current && <Check className="w-3 h-3 text-[var(--accent)]" />}
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
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [reqStatus, setReqStatus] = useState<ReqStatus>('')
  const [reqId, setReqId] = useState('')
  const [search, setSearch] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [showCommands, setShowCommands] = useState(false)
  const [model, setModel] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc')
  const [contextMenu, setContextMenu] = useState<{ id: number; x: number; y: number } | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [loadSessionsKey, setLoadSessionsKey] = useState(0)
  const [autoScroll, setAutoScroll] = useState(true)
  const [replyingTo, setReplyingTo] = useState<Message | null>(null)

  const inputRef = useRef<HTMLTextAreaElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const pollRef = useRef<any>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch(`/api/hermes/sessions?limit=50&_=${Date.now()}`)
      const d = await res.json()
      if (d.sessions) setSessions(d.sessions)
    } catch {}
  }, [])

  const loadSession = useCallback(async (id: string) => {
    if (!id) return
    setActiveId(id)
    try {
      const res = await fetch(`/api/hermes/sessions/${id}`)
      const d = await res.json()
      if (d.messages) setMessages(d.messages)
      else setMessages([])
    } catch {
      setMessages([])
    }
  }, [])

  useEffect(() => { loadSessions() }, [loadSessions, loadSessionsKey])

  useEffect(() => {
    const el = endRef.current
    if (!el || !autoScroll) return
    el.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending, autoScroll])

  const onScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    setAutoScroll(el.scrollHeight - el.scrollTop - el.clientHeight < 80)
  }, [])

  const pollRequest = useCallback((requestId: string) => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    let attempts = 0
    const timer = setInterval(async () => {
      attempts++
      try {
        const res = await fetch(`/api/hermes/requests/${requestId}?_=${Date.now()}`)
        const d = await res.json()
        const r = d.request
        if (r?.status) setReqStatus(r.status)
        else setReqStatus('')
        if (r?.status === 'done' || r?.status === 'completed') {
          clearInterval(timer); pollRef.current = null
          setSending(false); setReqStatus('done'); setReplyingTo(null)
          const result = r.result || ''
          if (result) {
            setMessages(prev => {
              const exists = prev.some(m => m.role === 'assistant' && m.content === result && m.session_id === (activeId || requestId))
              if (exists) return prev
              return [...prev, {
                id: Date.now(), session_id: activeId || requestId, role: 'assistant',
                content: result, tool_name: null, tool_calls: null, timestamp: Math.floor(Date.now() / 1000)
              }]
            })
          }
          loadSessions()
        }
        if (r?.status === 'failed') {
          clearInterval(timer); pollRef.current = null
          setSending(false); setReqStatus('failed'); setReplyingTo(null)
          setMessages(prev => [...prev, {
            id: Date.now(), session_id: activeId || requestId, role: 'assistant',
            content: 'Error: ' + (r.error || 'Request failed'), tool_name: null, tool_calls: null,
            timestamp: Math.floor(Date.now() / 1000)
          }])
        }
      } catch {}
      if (attempts > 300) clearInterval(timer)
    }, 3000)
    pollRef.current = timer
  }, [activeId, loadSessions])

  const deleteSession = useCallback(async (id: string) => {
    try {
      await fetch(`/api/hermes/sessions/${id}`, { method: 'DELETE' })
      setSessions(prev => prev.filter(s => s.id !== id))
      if (activeId === id) { setActiveId(''); setMessages([]) }
      setDeleteConfirm(null)
    } catch {}
  }, [activeId])

  const deleteMessage = useCallback(async (sessionId: string, messageId: number) => {
    try {
      await fetch(`/api/hermes/sessions/${sessionId}/messages/${messageId}`, { method: 'DELETE' })
      setMessages(prev => prev.filter(m => m.id !== messageId))
      setContextMenu(null)
    } catch {}
  }, [])

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || sending) return
    const userMsg = {
      id: Date.now(), session_id: 'pending', role: 'user',
      content: text, tool_name: null, tool_calls: null, timestamp: Math.floor(Date.now() / 1000)
    }
    setMessages(prev => [...prev, userMsg])
    setInput(''); setShowCommands(false); setSending(true); setReqStatus('queued')

    if (text.startsWith('/')) {
      const cmd = text.split(' ')[0].toLowerCase()
      if (cmd === '/new') { setActiveId(''); setMessages([]); setSending(false); setReqStatus(''); setLoadSessionsKey(k => k + 1); return }
      if (cmd === '/clear') { setMessages([]); setSending(false); setReqStatus(''); return }
      if (cmd === '/model') { setModel(text.split(' ')[1] || 'gemini-flash'); setSending(false); setReqStatus(''); return }
      if (cmd === '/help') {
        setMessages(prev => [...prev, {
          id: Date.now(), session_id: activeId || 'system', role: 'assistant',
          content: COMMANDS.map(c => `**${c.name}** - ${c.desc}`).join('\n'),
          tool_name: null, tool_calls: null, timestamp: Math.floor(Date.now() / 1000)
        }])
        setSending(false); setReqStatus(''); return
      }
    }

    try {
      const body: any = { prompt: text, title: text.slice(0, 60), kind: 'chat' }
      if (model) body.model = model
      const res = await fetch('/api/hermes/dispatch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await res.json()
      const id = d.request?.id
      if (!id) { setSending(false); setReqStatus(''); return }
      setReqId(id); loadSessions(); pollRequest(id)
    } catch (e) {
      console.error(e); setSending(false); setReqStatus('')
    }
  }, [input, sending, loadSessions, pollRequest, model, activeId])

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {})
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault(); setActiveId(''); setMessages([]); inputRef.current?.focus()
      }
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && document.activeElement !== inputRef.current) {
        e.preventDefault(); setShowCommands(true); inputRef.current?.focus()
      }
      if (e.key === 'Escape') { setShowCommands(false); setContextMenu(null); setDeleteConfirm(null) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const filtered = sessions
    .filter(s => !search || (s.title || s.preview || s.id).toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const aT = a.last_active || a.started_at; const bT = b.last_active || b.started_at
      return sortOrder === 'desc' ? bT - aT : aT - bT
    })

  const grouped: Record<string, SessionSummary[]> = {
    today: [], yesterday: [], week: [], month: [], older: []
  }
  const now = Date.now() / 1000
  for (const s of filtered) {
    const ts = s.last_active || s.started_at
    const age = now - ts
    if (age < 86400) grouped.today.push(s)
    else if (age < 172800) grouped.yesterday.push(s)
    else if (age < 604800) grouped.week.push(s)
    else if (age < 2592000) grouped.month.push(s)
    else grouped.older.push(s)
  }

  const renderGroup = (label: string, items: SessionSummary[]) => {
    if (!items.length) return null
    return (
      <div className="mb-3">
        <div className="text-[9px] font-semibold text-[var(--text-4)] uppercase tracking-wider px-3 py-1.5">{label}</div>
        {items.map(s => (
          <button key={s.id} onClick={() => { loadSession(s.id); setSidebarOpen(false) }}
            className={`w-full text-left px-3 py-2.5 hover:bg-[var(--surface-2)] transition-all border-b border-[var(--line)]/50 last:border-0 group ${activeId === s.id ? 'bg-[var(--accent)]/10 border-l-2 border-l-[var(--accent)]' : 'border-l-2 border-l-transparent'}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <div className={`w-5 h-5 rounded-full ${getAvatarClass(s.source)} flex items-center justify-center text-[8px] font-bold text-black shrink-0`}>
                    {getInitial(s.title || s.id)}
                  </div>
                  <span className="text-[12px] font-medium text-[var(--text)] truncate">{s.title || s.preview || 'Untitled'}</span>
                </div>
                <div className="flex items-center gap-2 ml-6.5">
                  <SourceBadge source={s.source} />
                  {s.model && <span className="text-[9px] text-[var(--text-4)] font-mono">{s.model.split('/').pop()}</span>}
                  <span className="text-[9px] text-[var(--text-4)]">{timeAgo(s.last_active || s.started_at)}</span>
                </div>
              </div>
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm(s.id) }}
                  className="p-1 rounded hover:bg-[var(--down)]/20 text-[var(--text-4)] hover:text-[var(--down)] transition-all">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
            {deleteConfirm === s.id && (
              <div className="mt-2 ml-6.5 p-2 rounded-lg bg-[var(--down)]/10 border border-[var(--down)]/30 flex items-center gap-2">
                <span className="text-[10px] text-[var(--text-2)]">Delete?</span>
                <button onClick={() => deleteSession(s.id)} className="text-[10px] px-2 py-0.5 rounded bg-[var(--down)] text-white">Yes</button>
                <button onClick={() => setDeleteConfirm(null)} className="text-[10px] px-2 py-0.5 rounded bg-[var(--surface-2)] text-[var(--text-2)]">No</button>
              </div>
            )}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] md:h-screen -mx-4 md:mx-0 md:rounded-2xl overflow-hidden border border-[var(--line)]/50 bg-[var(--bg)] shadow-2xl shadow-black/20">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-72' : 'w-0'} shrink-0 border-r border-[var(--line)] bg-[var(--bg)]/80 backdrop-blur-xl transition-all duration-300 flex flex-col overflow-hidden`}>
        {/* Sidebar header */}
        <div className="p-3 border-b border-[var(--line)] space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[var(--accent)] to-[#00c8ff] flex items-center justify-center text-black font-bold text-sm shadow-lg shadow-[var(--accent)]/20">H</div>
              <div>
                <h1 className="text-[13px] font-bold text-[var(--text)]">GlyteOS</h1>
                <p className="text-[9px] text-[var(--text-4)]">Hermes Mission Control</p>
              </div>
            </div>
            <div className="flex gap-0.5">
              <button onClick={() => { setActiveId(''); setMessages([]); setLoadSessionsKey(k => k + 1) }}
                className="p-1.5 rounded-lg hover:bg-[var(--surface-2)] text-[var(--text-3)] hover:text-[var(--accent)] transition-all" title="New chat">
                <Plus className="w-4 h-4" />
              </button>
              <button onClick={() => setSidebarOpen(false)} className="p-1.5 rounded-lg hover:bg-[var(--surface-2)] text-[var(--text-3)] hover:text-[var(--text)] transition-all md:hidden">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-4)]" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search conversations..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[var(--surface-1)] border border-[var(--line)] text-[12px] text-[var(--text)] placeholder-[var(--text-3)] focus:outline-none focus:border-[var(--accent)] transition-colors" />
          </div>
        </div>
        {/* Session list */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {renderGroup('Today', grouped.today)}
          {renderGroup('Yesterday', grouped.yesterday)}
          {renderGroup('This Week', grouped.week)}
          {renderGroup('This Month', grouped.month)}
          {renderGroup('Older', grouped.older)}
          {filtered.length === 0 && (
            <div className="p-4 text-center">
              <MessageSquare className="w-8 h-8 text-[var(--text-4)] mx-auto mb-2" />
              <p className="text-[11px] text-[var(--text-4)]">No conversations yet</p>
            </div>
          )}
        </div>
        {/* Sidebar footer */}
        <div className="p-2 border-t border-[var(--line)] flex items-center justify-between">
          <button onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
            className="text-[10px] text-[var(--text-4)] hover:text-[var(--text-3)] px-2 py-1 rounded hover:bg-[var(--surface-2)] transition-all">
            {sortOrder === 'desc' ? 'Oldest first' : 'Newest first'}
          </button>
          <span className="text-[9px] text-[var(--text-4)]">{sessions.length} chats</span>
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0 bg-[var(--bg)]">
        {/* Chat header */}
        <div className="flex items-center gap-2 px-3 md:px-4 py-2.5 border-b border-[var(--line)] shrink-0 bg-[var(--bg)]/80 backdrop-blur-xl z-10">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-[var(--text-3)] hover:text-[var(--text)] p-1.5 rounded-lg hover:bg-[var(--surface-2)] transition-all md:hidden">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="w-8 h-8 rounded-full avatar-gradient-1 flex items-center justify-center text-[11px] font-bold text-black">H</div>
          <div className="flex-1 min-w-0">
            <h2 className="text-[13px] font-semibold text-[var(--text)] truncate">
              {activeId ? (sessions.find(s => s.id === activeId)?.title || 'Chat') : 'New conversation'}
            </h2>
            <div className="flex items-center gap-1.5">
              {reqStatus === 'done' && <span className="text-[9px] text-green-400 flex items-center gap-0.5"><CheckCheck className="w-3 h-3" /> ready</span>}
              {reqStatus === 'running' && <span className="text-[9px] text-[var(--accent)] flex items-center gap-0.5"><Loader2 className="w-3 h-3 animate-spin" /> typing</span>}
              {reqStatus === 'queued' && <span className="text-[9px] text-[var(--text-4)]">queued</span>}
              {reqStatus === 'failed' && <span className="text-[9px] text-[var(--down)] flex items-center gap-0.5"><AlertCircle className="w-3 h-3" /> error</span>}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {activeId && (
              <button onClick={() => { setActiveId(''); setMessages([]) }}
                className="p-1.5 rounded-lg hover:bg-[var(--surface-2)] text-[var(--text-3)] hover:text-[var(--text)] transition-all md:hidden" title="Close">
                <X className="w-4 h-4" />
              </button>
            )}
            <ModelSelector current={model} onChange={setModel} />
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-3 md:px-4 py-4 space-y-1" onScroll={onScroll}>
          {messages.length === 0 && !sending && (
            <div className="flex flex-col items-center justify-center h-full text-center px-4 fade-in-up">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--accent)]/20 to-[#00c8ff]/10 flex items-center justify-center mb-3 border border-[var(--accent)]/20">
                <MessageSquare className="w-8 h-8 text-[var(--accent)]" />
              </div>
              <h3 className="text-[15px] font-semibold text-[var(--text)] mb-1">Start a conversation</h3>
              <p className="text-[12px] text-[var(--text-3)] mb-4 max-w-xs">Send a message to Hermes. Use `/` for commands, hold mic to talk.</p>
              <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
                {[
                  { label: 'Say hello', text: 'Hello Hermes!' },
                  { label: 'What can you do?', text: 'What can you do?' },
                  { label: '/status', text: '/status' },
                  { label: '/help', text: '/help' },
                ].map(s => (
                  <button key={s.label} onClick={() => { setInput(s.text); inputRef.current?.focus() }}
                    className="px-3 py-2 rounded-xl bg-[var(--surface-1)] border border-[var(--line)] text-[11px] text-[var(--text-3)] hover:text-[var(--text)] hover:border-[var(--accent)]/30 transition-all">
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => {
            const isUser = msg.role === 'user'
            const isLast = i === messages.length - 1
            const showAvatar = !isUser && (isLast || messages[i + 1]?.role !== msg.role)
            return (
              <div key={`${msg.id}-${i}`} className={`flex ${isUser ? 'justify-end' : 'justify-start'} group msg-in`}>
                <div className={`flex items-end gap-2 max-w-[85%] md:max-w-[75%] ${isUser ? 'flex-row-reverse' : ''}`}>
                  {!isUser && (
                    <div className={`w-7 h-7 rounded-full ${getAvatarClass(msg.session_id || 'default')} flex items-center justify-center text-[10px] font-bold text-black shrink-0 ${showAvatar ? 'opacity-100' : 'opacity-0'}`}>
                      H
                    </div>
                  )}
                  <div className={`relative ${isUser ? 'order-1' : ''}`}>
                    <div className={`px-3.5 py-2.5 rounded-2xl ${isUser ? 'bg-gradient-to-br from-[var(--accent)] to-[#00c8ff] text-black rounded-br-md' : 'bg-[var(--surface-2)] border border-[var(--line)] text-[var(--text)] rounded-bl-md'} shadow-lg ${isUser ? 'shadow-[var(--accent)]/10' : 'shadow-black/10'}`}>
                      <MessageContent content={msg.content || ''} role={msg.role} />
                    </div>
                    {/* Message actions */}
                    <div className={`flex items-center gap-0.5 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity ${isUser ? 'justify-end' : 'justify-start'}`}>
                      <button onClick={() => setContextMenu(contextMenu?.id === msg.id ? null : { id: msg.id, x: 0, y: 0 })}
                        className="p-1 rounded hover:bg-[var(--surface-2)] text-[var(--text-4)] hover:text-[var(--text-3)]">
                        <MoreVertical className="w-3 h-3" />
                      </button>
                    </div>
                    {/* Context menu */}
                    {contextMenu?.id === msg.id && (
                      <div className="absolute z-50 bottom-full mb-1 left-0 bg-[var(--surface-1)] border border-[var(--line)] rounded-xl shadow-2xl shadow-black/40 overflow-hidden min-w-[140px]">
                        <button onClick={() => { copyToClipboard(msg.content || ''); setContextMenu(null) }} className="w-full text-left px-3 py-2 hover:bg-[var(--accent)]/10 flex items-center gap-2 text-[11px] text-[var(--text-2)]">
                          <Copy className="w-3 h-3" /> Copy
                        </button>
                        {isUser && (
                          <button onClick={() => { setInput(msg.content || ''); inputRef.current?.focus(); setContextMenu(null) }} className="w-full text-left px-3 py-2 hover:bg-[var(--accent)]/10 flex items-center gap-2 text-[11px] text-[var(--text-2)]">
                            <Edit3 className="w-3 h-3" /> Edit
                          </button>
                        )}
                        <button onClick={() => { if (confirm('Delete this message?')) deleteMessage(msg.session_id, msg.id) }} className="w-full text-left px-3 py-2 hover:bg-[var(--down)]/10 flex items-center gap-2 text-[11px] text-[var(--down)]">
                          <Trash2 className="w-3 h-3" /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <div className={`text-[9px] text-[var(--text-4)] mt-1 px-1 ${isUser ? 'text-right' : 'text-left'} w-full`}>
                  {formatTime(msg.timestamp)}
                  {isUser && <span className="ml-1"><Check className="w-3 h-3 inline" /></span>}
                </div>
              </div>
            )
          })}
          {sending && <TypingIndicator status={reqStatus} />}
          <div ref={endRef} />
        </div>

        {/* Input area */}
        <div className="shrink-0 p-3 md:p-4 border-t border-[var(--line)] bg-[var(--bg)]/80 backdrop-blur-xl">
          {deleteConfirm && (
            <div className="mb-2 p-2 rounded-lg bg-[var(--down)]/10 border border-[var(--down)]/30 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-[var(--down)]" />
              <span className="text-[11px] text-[var(--text-2)] flex-1">Delete this conversation?</span>
              <button onClick={() => { if (deleteConfirm) deleteSession(deleteConfirm) }} className="text-[10px] px-2.5 py-1 rounded-lg bg-[var(--down)] text-white font-medium">Delete</button>
              <button onClick={() => setDeleteConfirm(null)} className="text-[10px] px-2.5 py-1 rounded-lg bg-[var(--surface-2)] text-[var(--text-2)]">Cancel</button>
            </div>
          )}
          {showCommands && (
            <CommandPalette onSelect={(cmd) => { setInput(cmd + ' '); setShowCommands(false); inputRef.current?.focus() }} onClose={() => setShowCommands(false)} />
          )}
          <div className="flex items-end gap-2">
            <div className="flex-1 relative">
              <textarea ref={inputRef} value={input} onChange={e => { setInput(e.target.value); if (e.target.value.startsWith('/')) setShowCommands(true) }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
                }}
                placeholder="Message Hermes... (/ for commands)"
                rows={1}
                className="w-full px-4 py-3 pr-20 rounded-2xl text-[13px] text-[var(--text)] bg-[var(--surface-1)] border border-[var(--line)] focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 placeholder-[var(--text-3)] resize-none transition-all"
                style={{ minHeight: '44px', maxHeight: '120px' }}
              />
              <div className="absolute right-2 bottom-2 flex items-center gap-1">
                <button onClick={() => setShowCommands(!showCommands)}
                  className="p-1.5 rounded-lg text-[var(--text-4)] hover:text-[var(--accent)] hover:bg-[var(--surface-2)] transition-all">
                  <span className="text-[10px] font-mono font-bold">/</span>
                </button>
                <button className="p-1.5 rounded-lg text-[var(--text-4)] hover:text-[var(--accent)] hover:bg-[var(--surface-2)] transition-all">
                  <Paperclip className="w-4 h-4" />
                </button>
              </div>
            </div>
            <button onClick={sendMessage} disabled={!input.trim() || sending}
              className="px-4 py-3 rounded-2xl text-[13px] font-semibold text-black bg-gradient-to-r from-[var(--accent)] to-[#00c8ff] hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 shadow-lg shadow-[var(--accent)]/20 shrink-0">
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
          <div className="flex items-center justify-between mt-1.5 px-1">
            <div className="text-[10px] text-[var(--text-4)]">
              {model && <span className="text-[var(--accent)] font-mono">{model}</span>}
            </div>
            <div className="text-[10px] text-[var(--text-4)] flex items-center gap-2">
              <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 rounded bg-[var(--surface-2)] border border-[var(--line)] text-[9px] font-mono">/</kbd> commands</span>
              <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 rounded bg-[var(--surface-2)] border border-[var(--line)] text-[9px] font-mono">⌘N</kbd> new</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
