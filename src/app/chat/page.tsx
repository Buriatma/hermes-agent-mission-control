"use client"
import { useState, useEffect, useCallback, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import {
  MessageSquare, Plus, Search, Trash2, Edit3, Copy, MoreVertical,
  ChevronDown, Send, Mic, Check, CheckCheck, AlertCircle,
  Loader2, X, HelpCircle, Terminal, Zap, Clock, ArrowLeft,
  Pin, Volume2, VolumeX, Download, Reply, Smile,
  ChevronRight, Hash, Command, PanelLeftClose, PanelLeft,
  Home, FolderOpen, Brain, ClipboardList, Image,
  RefreshCw, Undo2, Activity, History, Play, Cloud,
  ListOrdered, Target, GitCompareArrows, RotateCcw, GraduationCap,
  Database, Lightbulb, Boxes, Sparkles, Layers, PlugZap,
  BarChart3, TrendingUp, Wallet, User, UserCircle, Tag,
  ShieldCheck, ShieldX, RotateCw, Square, Minimize2, GitBranch, Cpu,
  Flame, Info, Columns3, BookOpen
} from 'lucide-react'

// ─── web audio sounds ──────────────────────────────────────────
function useChatSounds(enabled: boolean) {
  const ctxRef = useRef<AudioContext | null>(null)
  const getCtx = () => {
    if (!ctxRef.current) ctxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    return ctxRef.current
  }
  const beep = (freq = 800, ms = 80) => {
    if (!enabled) return
    try {
      const ctx = getCtx()
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.connect(g); g.connect(ctx.destination)
      o.frequency.value = freq; g.gain.value = 0.08
      o.start(); setTimeout(() => { o.stop(); g.disconnect() }, ms)
    } catch {}
  }
  return { send: () => beep(600, 60), receive: () => beep(900, 90), error: () => beep(200, 150) }
}

// ─── helpers ────────────────────────────────────────────────────
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
  return `${time} \u00b7 ${d.toLocaleString([], { month: 'short' })} ${d.getDate()}`
}
const AVATAR_CLS: Record<string, string> = {
  telegram: 'avatar-gradient-1', buzz: 'avatar-gradient-2', cli: 'avatar-gradient-3',
  api_server: 'avatar-gradient-4', subagent: 'avatar-gradient-5', tui: 'avatar-gradient-1',
  webui: 'avatar-gradient-2', desktop: 'avatar-gradient-3',
}
const getInitial = (t: string) => (t || 'H').slice(0, 1).toUpperCase()
function SourceBadge({ source }: { source: string }) {
  const c: Record<string, string> = {
    telegram: '#0088cc', buzz: '#00ff88', cli: '#f59e0b', api_server: '#8b5cf6',
    subagent: '#ef4444', tui: '#06b6d4', webui: '#ec4899', desktop: '#10b981',
  }
  return <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${c[source] || '#94a3b8'}20`, color: c[source] || '#94a3b8' }}>{source}</span>
}

const EMOJIS = ['\ud83d\udc4d','\u2764\ufe0f','\ud83d\ude02','\ud83c\udf89','\ud83d\udd25','\ud83d\udc40','\ud83d\ude80','\ud83d\udca1','\u2705','\ud83d\udc4f']
const HERMES_CMDS = [
  '/status','/help','/cost','/brief','/model','/new','/clear','/search','/export','/pin','/memory','/cron','/skills','/git','/health','/agents'
]

interface SessionSummary {
  id: string; source: string; model: string | null; title: string | null
  started_at: number; ended_at: number | null; end_reason: string | null
  message_count: number; tool_call_count: number
  input_tokens: number; output_tokens: number; cache_read_tokens: number; cache_write_tokens: number; reasoning_tokens: number
  estimated_cost_usd: number | null; actual_cost_usd: number | null
  billing_provider: string | null; preview: string; last_active: number | null; pinned?: boolean
}
interface Message {
  id: number; session_id: string; role: string; content: string | null
  tool_name: string | null; tool_calls: unknown; timestamp: number
  reply_to?: number | null; reactions?: Record<string, string[]>
  edited?: boolean; edited_at?: number
}
type ReqStatus = '' | 'queued' | 'running' | 'done' | 'failed'

// ════════════════════════════════════════════════════════════════
export default function ChatPage() {
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [activeId, setActiveId] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [reqStatus, setReqStatus] = useState<ReqStatus>('')
  const [reqId, setReqId] = useState('')
  const [search, setSearch] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showCommands, setShowCommands] = useState(false)
  const [model, setModel] = useState<string | null>(null)
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc')
  const [contextMenu, setContextMenu] = useState<number | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [replyingTo, setReplyingTo] = useState<Message | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editText, setEditText] = useState('')
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [msgSearchOpen, setMsgSearchOpen] = useState(false)
  const [msgSearch, setMsgSearch] = useState('')
  const [autoScroll, setAutoScroll] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const [loadKey, setLoadKey] = useState(0)

  const sounds = useChatSounds(soundEnabled)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const pollRef = useRef<any>(null)

  // ─── data ─────────────────────────────────────────────────────
  const loadSessions = useCallback(async () => {
    try {
      const r = await fetch(`/api/hermes/sessions?limit=50&_=${Date.now()}`)
      const d = await r.json()
      if (d.sessions) setSessions(d.sessions)
    } catch {}
  }, [])
  const loadSession = useCallback(async (id: string) => {
    if (!id) return
    setActiveId(id); setMessages([]); setReplyingTo(null); setEditingId(null)
    try {
      const r = await fetch(`/api/hermes/sessions/${id}`)
      const d = await r.json()
      if (d.messages) setMessages(d.messages)
    } catch { setMessages([]) }
  }, [])

  useEffect(() => { loadSessions() }, [loadSessions, loadKey])
  useEffect(() => {
    if (!autoScroll) return
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending, autoScroll])

  // ─── polling ──────────────────────────────────────────────────
  const pollRequest = useCallback((requestId: string) => {
    if (pollRef.current) clearInterval(pollRef.current)
    let attempts = 0
    const timer = setInterval(async () => {
      attempts++
      try {
        const r = await fetch(`/api/hermes/requests/${requestId}?_=${Date.now()}`)
        const d = await r.json()
        const req = d.request
        if (req?.status) setReqStatus(req.status)
        if (req?.status === 'done' || req?.status === 'completed') {
          clearInterval(timer); pollRef.current = null
          const result = req.result || ''
          if (result) {
            sounds.receive()
            setMessages(prev => {
              if (prev.some(m => m.role === 'assistant' && m.content === result)) return prev
              return [...prev, { id: Date.now(), session_id: activeId || requestId, role: 'assistant', content: result, tool_name: null, tool_calls: null, timestamp: Math.floor(Date.now() / 1000) }]
            })
          }
          setSending(false); setReqStatus('done'); setReplyingTo(null); loadSessions()
        }
        if (req?.status === 'failed') {
          clearInterval(timer); pollRef.current = null
          sounds.error()
          setMessages(prev => [...prev, { id: Date.now(), session_id: activeId || requestId, role: 'assistant', content: 'Error: ' + (req.error || 'Request failed'), tool_name: null, tool_calls: null, timestamp: Math.floor(Date.now() / 1000) }])
          setSending(false); setReqStatus('failed')
        }
      } catch {}
      if (attempts > 300) clearInterval(timer)
    }, 3000)
    pollRef.current = timer
  }, [activeId, loadSessions, sounds])

  // ─── delete session ───────────────────────────────────────────
  const deleteSession = useCallback(async (id: string) => {
    try {
      await fetch(`/api/hermes/sessions/${id}`, { method: 'DELETE' })
      setSessions(prev => prev.filter(s => s.id !== id))
      if (activeId === id) { setActiveId(''); setMessages([]) }
      setDeleteConfirm(null)
    } catch {}
  }, [activeId])

  // ─── pin/unpin ────────────────────────────────────────────────
  const togglePin = useCallback(async (id: string) => {
    setSessions(prev => prev.map(s => s.id === id ? { ...s, pinned: !s.pinned } : s))
  }, [])

  // ─── export ───────────────────────────────────────────────────
  const exportChat = useCallback(() => {
    const text = messages.map(m => {
      const t = new Date(m.timestamp * 1000).toISOString()
      const r = m.reply_to ? `\n> Reply to #${m.reply_to}\n` : ''
      const ed = m.edited ? ' [edited]' : ''
      return `[${t}] ${m.role.toUpperCase()}${ed}:\n${r}${m.content || ''}\n`
    }).join('\n---\n\n')
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `chat-${activeId || 'export'}.md`; a.click()
    URL.revokeObjectURL(url)
  }, [messages, activeId])

  // ─── send ─────────────────────────────────────────────────────
  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || sending) return
    sounds.send()
    const userMsg: Message = { id: Date.now(), session_id: 'pending', role: 'user', content: text, tool_name: null, tool_calls: null, timestamp: Math.floor(Date.now() / 1000), reply_to: replyingTo?.id || null }
    setMessages(prev => [...prev, userMsg])
    setInput(''); setShowCommands(false); setSending(true); setReqStatus('queued'); setReplyingTo(null)

    // ─── local commands ───────────────────────────────────────
    const cmd = text.split(' ')[0].toLowerCase()
    if (cmd === '/new') { setActiveId(''); setMessages([]); setSending(false); setReqStatus(''); setLoadKey(k => k + 1); return }
    if (cmd === '/clear') { setMessages([]); setSending(false); setReqStatus(''); return }
    if (cmd === '/export') { exportChat(); setSending(false); setReqStatus(''); return }
    if (cmd === '/model') {
      const m = text.split(' ')[1]
      if (m) { setModel(m); setMessages(prev => [...prev, { id: Date.now(), session_id: 'system', role: 'assistant', content: `Model switched to **${m}**`, tool_name: null, tool_calls: null, timestamp: Math.floor(Date.now() / 1000) }]) }
      setSending(false); setReqStatus(''); return
    }
    if (cmd === '/pin' && activeId) { togglePin(activeId); setSending(false); setReqStatus(''); return }

    // ─── hermes commands: dispatch to bridge ──────────────────
    // /status, /help, /cost, /brief, /memory, /cron, /skills, /git, /health, /agents, /search, /model <val>
    // All dispatched as real Hermes prompts (not filtered)
    // only /new, /clear, /export, /pin (local above) are local-only

    try {
      const body: any = { prompt: text, title: text.slice(0, 60), kind: 'chat' }
      if (model) body.model = model
      const r = await fetch('/api/hermes/dispatch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await r.json()
      const id = d.request?.id
      if (!id) { setSending(false); setReqStatus(''); return }
      setReqId(id); loadSessions(); pollRequest(id)
    } catch (e) {
      console.error(e); setSending(false); setReqStatus('')
    }
  }, [input, sending, loadSessions, pollRequest, model, activeId, replyingTo, sounds, exportChat, togglePin])

  // ─── keyboard ─────────────────────────────────────────────────
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') { e.preventDefault(); setActiveId(''); setMessages([]); inputRef.current?.focus() }
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') { e.preventDefault(); setSidebarOpen(v => !v) }
      if (e.key === 'Escape') { setShowCommands(false); setContextMenu(null); setDeleteConfirm(null); setMsgSearchOpen(false); setSidebarOpen(false) }
    }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [])

  // ─── sidebar grouping ─────────────────────────────────────────
  const pinned = sessions.filter(s => s.pinned).sort((a, b) => (b.last_active || b.started_at) - (a.last_active || a.started_at))
  const unpinned = sessions.filter(s => !s.pinned)
  const allSessions = sortOrder === 'desc' ? [...pinned, ...unpinned] : [...pinned, ...unpinned.reverse()]
  const filtered = allSessions.filter(s => !search || (s.title || s.preview || s.id).toLowerCase().includes(search.toLowerCase()))
  const now = Date.now() / 1000
  const grp: Record<string, SessionSummary[]> = { today: [], yesterday: [], week: [], month: [], older: [] }
  for (const s of filtered) {
    const age = now - (s.last_active || s.started_at)
    if (age < 86400) grp.today.push(s)
    else if (age < 172800) grp.yesterday.push(s)
    else if (age < 604800) grp.week.push(s)
    else if (age < 2592000) grp.month.push(s)
    else grp.older.push(s)
  }

  const renderGroup = (label: string, items: SessionSummary[]) => {
    if (!items.length) return null
    return (
      <div className="mb-2">
        <div className="text-[9px] font-semibold text-[var(--text-4)] uppercase tracking-wider px-3 py-1.5">{label}</div>
        {items.map(s => {
          const isActive = activeId === s.id
          const preview = (s.title || s.preview || 'Untitled').slice(0, 40)
          return (
            <button key={s.id} onClick={() => { loadSession(s.id); setSidebarOpen(false) }}
              className={`w-full text-left px-3 py-2.5 hover:bg-[var(--surface-2)] transition-all border-b border-[var(--line)]/50 group ${isActive ? 'bg-[var(--accent)]/10 border-l-2 border-l-[var(--accent)]' : 'border-l-2 border-l-transparent'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className={`w-8 h-8 rounded-full ${AVATAR_CLS[s.source] || 'avatar-gradient-1'} flex items-center justify-center text-[10px] font-bold text-black shrink-0`}>
                    {getInitial(preview)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[12px] font-medium text-[var(--text)] truncate">{preview}</span>
                      {s.pinned && <Pin className="w-2.5 h-2.5 text-[var(--accent)] fill-current shrink-0" />}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <SourceBadge source={s.source} />
                      {s.model && <span className="text-[9px] text-[var(--text-4)] font-mono">{s.model.split('/').pop()}</span>}
                      <span className="text-[9px] text-[var(--text-4)]">{timeAgo(s.last_active || s.started_at)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <button onClick={(e) => { e.stopPropagation(); togglePin(s.id) }}
                    className={`p-1 rounded ${s.pinned ? 'text-[var(--accent)]' : 'text-[var(--text-4)] hover:text-[var(--text)]'}`}>
                    <Pin className="w-3 h-3" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setDeleteConfirm(s.id) }}
                    className="p-1 rounded hover:bg-[var(--down)]/20 text-[var(--text-4)] hover:text-[var(--down)]">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
              {deleteConfirm === s.id && (
                <div className="mt-2 ml-10 p-2 rounded-lg bg-[var(--down)]/10 border border-[var(--down)]/30 flex items-center gap-2">
                  <span className="text-[10px] text-[var(--text-2)]">Delete?</span>
                  <button onClick={() => deleteSession(s.id)} className="text-[10px] px-2 py-0.5 rounded bg-[var(--down)] text-white">Yes</button>
                  <button onClick={() => setDeleteConfirm(null)} className="text-[10px] px-2 py-0.5 rounded bg-[var(--surface-2)] text-[var(--text-2)]">No</button>
                </div>
              )}
            </button>
          )
        })}
      </div>
    )
  }

  // ─── reaction picker ──────────────────────────────────────────
  const ReactionPicker = ({ msgId, sessionId }: { msgId: number; sessionId: string }) => {
    const [open, setOpen] = useState(false)
    return (
      <div className="relative">
        <button onClick={() => setOpen(!open)} className="p-1 rounded hover:bg-[var(--surface-2)] text-[var(--text-4)] hover:text-[var(--text-3)]">
          <Smile className="w-3.5 h-3.5" />
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div className="absolute z-50 bottom-full mb-1 right-0 bg-[var(--surface-1)] border border-[var(--line)] rounded-xl shadow-2xl p-1.5 flex gap-0.5">
              {EMOJIS.map(em => (
                <button key={em} onClick={() => {
                  setMessages(prev => prev.map(m => {
                    if (m.id !== msgId) return m
                    const rx = { ...(m.reactions || {}) }
                    const list = rx[em] || []
                    const next = list.includes('me') ? list.filter((u: string) => u !== 'me') : [...list, 'me']
                    if (next.length === 0) delete rx[em]; else rx[em] = next
                    return { ...m, reactions: rx }
                  }))
                  setOpen(false)
                }} className="w-8 h-8 rounded-lg hover:bg-[var(--surface-2)] flex items-center justify-center text-sm transition-all hover:scale-125">
                  {em}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    )
  }

  // ─── message component ────────────────────────────────────────
  const renderMessage = (msg: Message) => {
    const isUser = msg.role === 'user'
    const replyMsg = msg.reply_to ? messages.find(m => m.id === msg.reply_to) : null
    return (
      <div className={`px-3 md:px-5 py-1 ${isUser ? 'flex justify-end' : 'flex justify-start'} group/msg`}>
        <div className={`flex items-end gap-2.5 max-w-[92%] md:max-w-[75%] ${isUser ? 'flex-row-reverse' : ''}`}>
          {!isUser && (
            <div className="w-7 h-7 rounded-full avatar-gradient-1 flex items-center justify-center text-[10px] font-bold text-black shrink-0 mb-5">
              H
            </div>
          )}
          <div className="min-w-0">
            {replyMsg && (
              <div className={`mb-1 px-3 py-1.5 rounded-lg border-l-2 ${isUser ? 'border-[var(--accent)] bg-[var(--accent)]/5' : 'border-[var(--text-3)] bg-[var(--surface-1)]'} text-[10px] text-[var(--text-3)]`}>
                <span className="font-medium">{replyMsg.role === 'user' ? 'You' : 'Hermes'}</span>: {(replyMsg.content || '').slice(0, 80)}
              </div>
            )}
            <div className={`px-3.5 py-2.5 rounded-2xl ${isUser ? 'bg-gradient-to-br from-[var(--accent)] to-[#00c8ff] text-black rounded-br-md' : 'bg-[var(--surface-2)] border border-[var(--line)] text-[var(--text)] rounded-bl-md'} shadow-lg ${isUser ? 'shadow-[var(--accent)]/10' : 'shadow-black/10'}`}>
              {editingId === msg.id ? (
                <div className="space-y-2">
                  <textarea value={editText} onChange={e => setEditText(e.target.value)}
                    className="w-full px-2 py-1.5 rounded-lg bg-black/20 border border-white/10 text-[13px] resize-none focus:outline-none focus:border-[var(--accent)]"
                    rows={3} autoFocus />
                  <div className="flex gap-1.5 justify-end">
                    <button onClick={() => { /* save edit */ setEditingId(null) }} className="text-[10px] px-2.5 py-1 rounded-lg bg-[var(--accent)] text-black font-medium">Save</button>
                    <button onClick={() => { setEditingId(null); setEditText('') }} className="text-[10px] px-2.5 py-1 rounded-lg bg-[var(--surface-2)] text-[var(--text-2)]">Cancel</button>
                  </div>
                </div>
              ) : (
                msg.role === 'user' ? (
                  <div className="text-[13px] leading-relaxed whitespace-pre-wrap break-words">{msg.content}</div>
                ) : (
                  <div className="text-[13px] leading-relaxed break-words markdown-body">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>{msg.content || ''}</ReactMarkdown>
                  </div>
                )
              )}
              {Object.keys(msg.reactions || {}).length > 0 && (
                <div className="flex gap-1 mt-1.5 flex-wrap">
                  {Object.entries(msg.reactions || {}).map(([em, users]) => (
                    <button key={em} className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--accent)]/10 border border-[var(--accent)]/20 hover:bg-[var(--accent)]/20">
                      {em} {users.length}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* hover actions */}
            <div className={`flex items-center gap-0.5 mt-0.5 opacity-0 group-hover/msg:opacity-100 transition-opacity ${isUser ? 'justify-end' : 'justify-start'}`}>
              <button onClick={() => setReplyingTo(msg)} className="p-1 rounded hover:bg-[var(--surface-2)] text-[var(--text-4)] hover:text-[var(--text-3)]" title="Reply"><Reply className="w-3.5 h-3.5" /></button>
              <button onClick={() => navigator.clipboard.writeText(msg.content || '')} className="p-1 rounded hover:bg-[var(--surface-2)] text-[var(--text-4)] hover:text-[var(--text-3)]" title="Copy"><Copy className="w-3.5 h-3.5" /></button>
              {isUser && <button onClick={() => { setEditingId(msg.id); setEditText(msg.content || '') }} className="p-1 rounded hover:bg-[var(--surface-2)] text-[var(--text-4)] hover:text-[var(--text-3)]" title="Edit"><Edit3 className="w-3.5 h-3.5" /></button>}
              <ReactionPicker msgId={msg.id} sessionId={msg.session_id} />
              <button onClick={() => setContextMenu(contextMenu === msg.id ? null : msg.id)} className="p-1 rounded hover:bg-[var(--surface-2)] text-[var(--text-4)] hover:text-[var(--text-3)]"><MoreVertical className="w-3.5 h-3.5" /></button>
            </div>
            <div className={`text-[9px] text-[var(--text-4)] mt-0.5 px-0.5 flex items-center gap-1 ${isUser ? 'justify-end' : 'justify-start'}`}>
              <span>{formatTime(msg.timestamp)}</span>
              {msg.edited && <span>(edited)</span>}
              {isUser && <Check className="w-3 h-3 text-[var(--text-3)]" />}
            </div>
            {contextMenu === msg.id && (
              <div className="absolute z-50 mt-1 bg-[var(--surface-1)] border border-[var(--line)] rounded-xl shadow-2xl shadow-black/40 overflow-hidden min-w-[140px]">
                <button onClick={() => { navigator.clipboard.writeText(msg.content || ''); setContextMenu(null) }} className="w-full text-left px-3 py-2 hover:bg-[var(--accent)]/10 flex items-center gap-2 text-[11px] text-[var(--text-2)]"><Copy className="w-3 h-3" /> Copy</button>
                {isUser && <button onClick={() => { setEditingId(msg.id); setEditText(msg.content || ''); setContextMenu(null) }} className="w-full text-left px-3 py-2 hover:bg-[var(--accent)]/10 flex items-center gap-2 text-[11px] text-[var(--text-2)]"><Edit3 className="w-3 h-3" /> Edit</button>}
                <button onClick={() => { if (confirm('Delete?')) { setMessages(prev => prev.filter(m => m.id !== msg.id)); setContextMenu(null) } }} className="w-full text-left px-3 py-2 hover:bg-[var(--down)]/10 flex items-center gap-2 text-[11px] text-[var(--down)]"><Trash2 className="w-3 h-3" /> Delete</button>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  const models = ['auto', 'gemini-flash', 'gemini-2.5-flash', 'claude-3.5-sonnet', 'gpt-4o', 'best-long-context', 'best-coding', 'big-pickle', 'deepseek-v4-flash-free', 'x-preview-f-free', 'hy3-free', 'laguna-s-2.1-free', 'nemotron-3-ultra-free', 'nemotron-3.5-lightning-free', 'muse-spark-1.2-contributor-free']

  return (
    <div className="h-full flex flex-col bg-[var(--bg)] overflow-hidden">

      {/* ── Top Header ─────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[var(--line)] shrink-0 bg-[var(--bg)] z-30 h-14">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <button onClick={() => setSidebarOpen(true)} className="p-2 -ml-2 text-[var(--text-4)] md:hidden">
            <PanelLeft className="w-5 h-5" />
          </button>
          <div className="w-8 h-8 rounded-full avatar-gradient-1 flex items-center justify-center text-[10px] font-bold text-black shrink-0">H</div>
          <div className="flex-1 min-w-0">
            <h2 className="text-[13px] font-semibold text-[var(--text)] truncate leading-tight">
              {activeId ? (sessions.find(s => s.id === activeId)?.title || 'Chat') : 'New Chat'}
            </h2>
            <div className="flex items-center gap-1.5">
              {reqStatus === 'done' && <span className="text-[8px] text-green-400 flex items-center gap-0.5">● ready</span>}
              {reqStatus === 'running' && <span className="text-[8px] text-[var(--accent)] flex items-center gap-0.5">● typing</span>}
              {!reqStatus && <span className="text-[8px] text-[var(--text-4)] uppercase tracking-wider">{messages.length} messages</span>}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-1.5">
          <div className="relative">
            <button onClick={() => setMenuOpen(!menuOpen)} className="flex items-center gap-1 px-2 py-1 rounded bg-[var(--surface-1)] border border-[var(--line)] text-[10px] text-[var(--text-2)] hover:border-[var(--accent)] transition-colors max-w-[80px] truncate">
              {model} <ChevronDown className="w-3 h-3 opacity-50" />
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                <div className="absolute top-full right-0 mt-1 w-48 bg-[var(--surface-1)] border border-[var(--line)] rounded-lg shadow-xl py-1 z-50 animate-in fade-in slide-in-from-top-2 duration-100">
                  {models.map(m => (
                    <button key={m} onClick={() => { setModel(m); setMenuOpen(false) }}
                      className={`w-full text-left px-3 py-2 text-[11px] hover:bg-[var(--accent)]/10 flex items-center justify-between ${model === m ? 'text-[var(--accent)]' : 'text-[var(--text-3)]'}`}>
                      {m} {model === m && <Check className="w-3 h-3" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          
          <button onClick={() => window.location.reload()} className="p-2 rounded-lg hover:bg-[var(--surface-2)] text-[var(--text-3)]">
            <RefreshCw className="w-4 h-4" />
          </button>
          
          {activeId && (
            <>
              <button onClick={exportChat} className="p-2 rounded-lg hover:bg-[var(--surface-2)] text-[var(--text-3)] hidden md:block" title="Export"><Download className="w-4 h-4" /></button>
            </>
          )}
        </div>
      </div>

      {/* ── Main area: sidebar overlay + chat ────────────────── */}

      {/* ── Sidebar (Mobile Overlay & Desktop persistent) ────────────────── */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />}
      <div className={`fixed md:relative inset-y-0 left-0 z-50 w-72 md:w-64 border-r border-[var(--line)] bg-[var(--bg)] flex flex-col transition-transform duration-300 shrink-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="p-3 border-b border-[var(--line)] space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl avatar-gradient-1 flex items-center justify-center text-[11px] font-bold text-black">H</div>
              <div>
                <h1 className="text-[13px] font-bold text-[var(--text)]">GlyteOS</h1>
                <p className="text-[9px] text-[var(--text-4)]">Hermes Mission Control</p>
              </div>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="p-1.5 rounded-lg hover:bg-[var(--surface-2)] text-[var(--text-3)] md:hidden"><X className="w-4 h-4" /></button>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-4)]" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
              className="w-full pl-8 pr-3 py-2 rounded-lg bg-[var(--surface-1)] border border-[var(--line)] text-[12px] text-[var(--text)] placeholder-[var(--text-3)] focus:outline-none focus:border-[var(--accent)]" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {pinned.length > 0 && renderGroup('Pinned', pinned)}
          {renderGroup('Today', grp.today)}
          {renderGroup('Yesterday', grp.yesterday)}
          {renderGroup('This Week', grp.week)}
          {renderGroup('This Month', grp.month)}
          {renderGroup('Older', grp.older)}
        </div>
        <div className="p-2 border-t border-[var(--line)] flex items-center justify-between">
          <button onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')} className="text-[10px] text-[var(--text-4)] hover:text-[var(--text-3)] px-2 py-1 rounded hover:bg-[var(--surface-2)]">
            {sortOrder === 'desc' ? 'Oldest first' : 'Newest first'}
          </button>
          <span className="text-[9px] text-[var(--text-4)]">{sessions.length} chats</span>
        </div>
      </div>

      <div className="flex-1 relative flex overflow-hidden">

        {/* ── Chat Content ────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0">

          {/* Messages scroll */}
          <div className="flex-1 overflow-y-auto overscroll-contain py-3" onScroll={e => {
            const el = e.currentTarget
            setAutoScroll(el.scrollHeight - el.scrollTop - el.clientHeight < 80)
          }}>
            {messages.length === 0 && !sending && (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--accent)]/20 to-[#00c8ff]/10 flex items-center justify-center mb-3 border border-[var(--accent)]/20">
                  <MessageSquare className="w-8 h-8 text-[var(--accent)]" />
                </div>
                <h3 className="text-[15px] font-semibold text-[var(--text)] mb-1">Start a conversation</h3>
                <p className="text-[12px] text-[var(--text-3)] mb-4 max-w-xs">Send a message to Hermes. Use `/` for commands.</p>
                <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
                  {[
                    { label: 'Say hello', text: 'Hello Hermes!' },
                    { label: 'What can you do?', text: 'What can you do?' },
                    { label: '/status', text: '/status' },
                    { label: '/help', text: '/help' },
                  ].map(s => (
                    <button key={s.label} onClick={() => { setInput(s.text); inputRef.current?.focus() }} className="px-3 py-2.5 rounded-xl bg-[var(--surface-1)] border border-[var(--line)] text-[11px] text-[var(--text-3)] hover:text-[var(--text)] hover:border-[var(--accent)]/30 transition-all">{s.label}</button>
                  ))}
                </div>
              </div>
            )}

            {msgSearchOpen && (
              <div className="mx-3 md:mx-5 mb-2 flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-[var(--text-4)]" />
                <input autoFocus value={msgSearch} onChange={e => setMsgSearch(e.target.value)} placeholder="Search in chat..."
                  className="flex-1 px-3 py-1.5 rounded-lg bg-[var(--surface-1)] border border-[var(--line)] text-[12px] text-[var(--text)] placeholder-[var(--text-3)] focus:outline-none focus:border-[var(--accent)]" />
                <button onClick={() => { setMsgSearchOpen(false); setMsgSearch('') }} className="text-[var(--text-4)] hover:text-[var(--text)]"><X className="w-3.5 h-3.5" /></button>
              </div>
            )}

            {messages.map(msg => renderMessage(msg))}

            {sending && (
              <div className="px-3 md:px-5 py-1 flex justify-start">
                <div className="flex items-center gap-3 bg-[var(--surface-2)] border border-[var(--line)] rounded-2xl rounded-bl-md px-4 py-3 shadow-lg">
                  <div className="w-7 h-7 rounded-full avatar-gradient-1 flex items-center justify-center text-[10px] font-bold text-black shrink-0">H</div>
                  <div className="flex gap-1.5">
                    <span className="typing-dot" style={{ animationDelay: '0ms' }} />
                    <span className="typing-dot" style={{ animationDelay: '200ms' }} />
                    <span className="typing-dot" style={{ animationDelay: '400ms' }} />
                  </div>
                  <span className="text-[11px] text-[var(--text-3)]">{reqStatus === 'queued' ? 'Queued...' : 'Working...'}</span>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* ── Input bar ────────────────────────────────────── */}
          <div className="shrink-0 border-t border-[var(--line)] bg-[var(--bg)]">
            {replyingTo && (
              <div className="mx-3 md:mx-4 mt-2 p-2 rounded-lg bg-[var(--surface-1)] border border-[var(--line)] flex items-center gap-2">
                <Reply className="w-3.5 h-3.5 text-[var(--accent)]" />
                <span className="text-[11px] text-[var(--text-2)] flex-1 truncate">Replying to: {(replyingTo.content || '').slice(0, 60)}</span>
                <button onClick={() => setReplyingTo(null)} className="text-[var(--text-4)] hover:text-[var(--text)]"><X className="w-3.5 h-3.5" /></button>
              </div>
            )}
            {showCommands && (
              <CommandList
                onSelect={(cmd) => { setInput(cmd + ' '); setShowCommands(false); inputRef.current?.focus() }}
                onClose={() => setShowCommands(false)}
              />
            )}
            <div className="flex items-end gap-2 p-3 md:p-4">
              <div className="flex-1 relative">
                <textarea ref={inputRef} value={input}
                  onChange={e => { setInput(e.target.value); if (e.target.value === '/') setShowCommands(true) }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
                  }}
                  placeholder={replyingTo ? "Reply..." : "Message Hermes... (/ for commands)"}
                  rows={1}
                  className="w-full px-4 py-3 pr-24 rounded-2xl text-[14px] text-[var(--text)] bg-[var(--surface-1)] border border-[var(--line)] focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 placeholder-[var(--text-3)] resize-none transition-all"
                  style={{ minHeight: '48px', maxHeight: '120px' }}
                />
                <div className="absolute right-2 bottom-2.5 flex items-center gap-0.5">
                  <button onClick={() => setShowCommands(!showCommands)} className="p-1.5 rounded-lg text-[var(--text-4)] hover:text-[var(--accent)] hover:bg-[var(--surface-2)]" title="Commands">
                    <Command className="w-4 h-4" />
                  </button>
                  <button onClick={() => setMsgSearchOpen(!msgSearchOpen)} className="p-1.5 rounded-lg text-[var(--text-4)] hover:text-[var(--accent)] hover:bg-[var(--surface-2)] md:hidden" title="Search">
                    <Search className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <button onClick={sendMessage} disabled={!input.trim() || sending}
                className="w-12 h-12 rounded-full text-white bg-gradient-to-br from-[var(--accent)] to-[#00c8ff] hover:opacity-90 disabled:opacity-30 transition-all active:scale-90 shadow-lg shadow-[var(--accent)]/20 flex items-center justify-center shrink-0">
                {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </button>
            </div>
            <div className="hidden md:flex items-center justify-between px-6 pb-2 text-[10px] text-[var(--text-4)]">
              <span className="font-mono text-[var(--accent)]/60">{model || 'auto'}</span>
              <div className="flex items-center gap-3">
                <span><kbd className="px-1 py-0.5 rounded bg-[var(--surface-2)] border border-[var(--line)] text-[9px] font-mono">/</kbd> commands</span>
                <span><kbd className="px-1 py-0.5 rounded bg-[var(--surface-2)] border border-[var(--line)] text-[9px] font-mono">Ctrl+N</kbd> new</span>
                <span><kbd className="px-1 py-0.5 rounded bg-[var(--surface-2)] border border-[var(--line)] text-[9px] font-mono">Ctrl+B</kbd> sidebar</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Command List ──────────────────────────────────────────────
function CommandList({ onSelect, onClose }: { onSelect: (c: string) => void; onClose: () => void }) {
  const [q, setQ] = useState('')
  const cmds = [
    // Session
    { name: '/new', desc: 'Fresh session', icon: Plus, group: 'Session' },
    { name: '/clear', desc: 'Clear messages', icon: Trash2, group: 'Session' },
    { name: '/retry', desc: 'Resend last message', icon: RefreshCw, group: 'Session' },
    { name: '/undo', desc: 'Back up N turns', icon: Undo2, group: 'Session' },
    { name: '/title', desc: 'Name the session', icon: Hash, group: 'Session' },
    { name: '/compress', desc: 'Compress context', icon: Minimize2, group: 'Session' },
    { name: '/stop', desc: 'Kill background processes', icon: Square, group: 'Session' },
    { name: '/status', desc: 'Session, model, token info', icon: Activity, group: 'Session' },
    { name: '/sessions', desc: 'Browse previous sessions', icon: History, group: 'Session' },
    { name: '/resume', desc: 'Resume named session', icon: Play, group: 'Session' },
    { name: '/branch', desc: 'Branch the session', icon: GitBranch, group: 'Session' },
    { name: '/background', desc: 'Run prompt in background', icon: Cloud, group: 'Session' },
    { name: '/queue', desc: 'Queue prompt for next turn', icon: ListOrdered, group: 'Session' },
    { name: '/goal', desc: 'Standing goal across turns', icon: Target, group: 'Session' },
    { name: '/diff', desc: 'Git changes in workspace', icon: GitCompareArrows, group: 'Session' },
    { name: '/rollback', desc: 'Filesystem checkpoints', icon: RotateCcw, group: 'Session' },
    // Config
    { name: '/model', desc: 'Switch model (provider:model)', icon: Cpu, group: 'Config' },
    { name: '/personality', desc: 'Set a personality', icon: Smile, group: 'Config' },
    { name: '/reasoning', desc: 'Reasoning effort/display', icon: Brain, group: 'Config' },
    { name: '/fast', desc: 'Priority processing tier', icon: Zap, group: 'Config' },
    { name: '/voice', desc: 'Voice mode on/off/tts', icon: Mic, group: 'Config' },
    { name: '/yolo', desc: 'Toggle approval bypass', icon: Flame, group: 'Config' },
    { name: '/footer', desc: 'Runtime metadata footer', icon: Info, group: 'Config' },
    // Tools & Skills
    { name: '/skills', desc: 'Search/install skills', icon: BookOpen, group: 'Tools' },
    { name: '/learn', desc: 'Learn a reusable skill', icon: GraduationCap, group: 'Tools' },
    { name: '/memory', desc: 'Review pending memory writes', icon: Database, group: 'Tools' },
    { name: '/cron', desc: 'Manage scheduled tasks', icon: Clock, group: 'Tools' },
    { name: '/suggestions', desc: 'Review suggested automations', icon: Lightbulb, group: 'Tools' },
    { name: '/blueprint', desc: 'Set up automation blueprint', icon: Boxes, group: 'Tools' },
    { name: '/curator', desc: 'Skill maintenance', icon: Sparkles, group: 'Tools' },
    { name: '/kanban', desc: 'Collaboration board', icon: Columns3, group: 'Tools' },
    { name: '/moa', desc: 'Mixture of Agents preset', icon: Layers, group: 'Tools' },
    { name: '/reload-skills', desc: 'Re-scan skills dir', icon: RefreshCw, group: 'Tools' },
    { name: '/reload-mcp', desc: 'Reload MCP servers', icon: PlugZap, group: 'Tools' },
    // Info
    { name: '/help', desc: 'Show commands', icon: HelpCircle, group: 'Info' },
    { name: '/usage', desc: 'Token usage and cost', icon: BarChart3, group: 'Info' },
    { name: '/insights', desc: 'Usage analytics', icon: TrendingUp, group: 'Info' },
    { name: '/cost', desc: 'Cost estimate', icon: Wallet, group: 'Info' },
    { name: '/whoami', desc: 'Access level', icon: User, group: 'Info' },
    { name: '/profile', desc: 'Active profile info', icon: UserCircle, group: 'Info' },
    { name: '/update', desc: 'Update Hermes', icon: RefreshCw, group: 'Info' },
    { name: '/version', desc: 'Show version', icon: Tag, group: 'Info' },
    // Export / local
    { name: '/export', desc: 'Export chat', icon: Download, group: 'Local' },
    { name: '/pin', desc: 'Pin conversation', icon: Pin, group: 'Local' },
    // Approved local dispatch commands
    { name: '/approve', desc: 'Approve pending dangerous cmd', icon: ShieldCheck, group: 'Gateway' },
    { name: '/deny', desc: 'Deny pending dangerous cmd', icon: ShieldX, group: 'Gateway' },
    { name: '/restart', desc: 'Restart gateway', icon: RotateCw, group: 'Gateway' },
    { name: '/sethome', desc: 'Set home channel', icon: Home, group: 'Gateway' },
    { name: '/commands', desc: 'Browse all commands', icon: Command, group: 'Gateway' },
  ]
  const groups = ['Session', 'Config', 'Tools', 'Info', 'Gateway', 'Local']
  const filtered = cmds.filter(c => c.name.includes(q.toLowerCase()) || c.desc.toLowerCase().includes(q.toLowerCase()) || (c.group || '').toLowerCase().includes(q.toLowerCase()))
  const grouped = groups.map(g => ({ group: g, items: filtered.filter(c => c.group === g) })).filter(x => x.items.length)
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute bottom-full left-3 right-3 md:left-4 md:right-4 mb-2 bg-[var(--surface-1)] border border-[var(--line)] rounded-xl shadow-2xl shadow-black/40 overflow-hidden z-50 max-h-[50vh] flex flex-col">
        <div className="p-2 border-b border-[var(--line)] shrink-0">
          <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Type a command..."
            className="w-full px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--line)] text-[13px] text-[var(--text)] placeholder-[var(--text-3)] focus:outline-none focus:border-[var(--accent)]" />
        </div>
        <div className="flex-1 overflow-y-auto">
          {grouped.map(({ group, items }) => (
            <div key={group}>
              <div className="px-3 pt-2 pb-1 text-[9px] font-semibold text-[var(--text-4)] uppercase tracking-wider">{group}</div>
              {items.map(c => {
                const Icon = c.icon
                return (
                  <button key={c.name} onClick={() => onSelect(c.name)}
                    className="w-full text-left px-3 py-2 hover:bg-[var(--accent)]/10 flex items-center gap-3 border-b border-[var(--line)]/50 last:border-0">
                    <Icon className="w-4 h-4 text-[var(--text-3)]" />
                    <span className="text-[11px] font-mono text-[var(--accent)] font-semibold min-w-[70px]">{c.name}</span>
                    <span className="text-[11px] text-[var(--text-3)]">{c.desc}</span>
                  </button>
                )
              })}
            </div>
          ))}
          {filtered.length === 0 && <p className="text-xs text-[var(--text-3)] px-3 py-3 text-center">No commands found</p>}
        </div>
      </div>
    </>
  )
}

// ─── Model Selector ────────────────────────────────────────────
function ModelSelector({ current, onChange }: { current: string | null; onChange: (m: string) => void }) {
  const [open, setOpen] = useState(false)
  const models = ['auto', 'gemini-flash', 'gemini-2.5-flash', 'claude-3.5-sonnet', 'gpt-4o', 'best-long-context', 'best-coding', 'big-pickle', 'deepseek-v4-flash-free', 'x-preview-f-free', 'hy3-free', 'laguna-s-2.1-free', 'nemotron-3-ultra-free', 'nemotron-3.5-lightning-free', 'muse-spark-1.2-contributor-free']
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="text-[11px] px-2.5 py-1.5 rounded-full bg-[var(--surface-2)] border border-[var(--line)] text-[var(--text-3)] hover:text-[var(--accent)] hover:border-[var(--accent)]/50 transition-all flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
        {current || 'auto'}
        <ChevronDown className="w-2.5 h-2.5" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full right-0 mt-2 bg-[var(--surface-1)] border border-[var(--line)] rounded-xl shadow-2xl shadow-black/40 overflow-hidden z-50 min-w-[180px]">
            <div className="p-1.5 border-b border-[var(--line)]"><span className="text-[10px] text-[var(--text-4)] px-2 font-semibold uppercase tracking-wider">Model</span></div>
            {models.map(m => (
              <button key={m} onClick={() => { onChange(m === 'auto' ? null as any : m); setOpen(false) }}
                className={`w-full text-left px-3 py-2 flex items-center justify-between transition-all ${m === (current || 'auto') ? 'text-[var(--accent)] bg-[var(--accent)]/10' : 'text-[var(--text-3)] hover:bg-[var(--surface-2)]'}`}>
                <span className="text-[12px] font-mono">{m}</span>
                {m === (current || 'auto') && <Check className="w-3 h-3 text-[var(--accent)]" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
