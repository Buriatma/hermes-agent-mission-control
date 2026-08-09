"use client"
import { useState, useEffect, useCallback } from 'react'
import { Zap, Send, Loader2, CheckCircle, XCircle, Clock, MessageSquare, Brain, Shield, Mic, Globe, Terminal } from 'lucide-react'

interface Agent {
  id: string; name: string; role: string; icon: any; color: string; status: string; lastActive: string; tasksCompleted: number
}

const AGENTS: Agent[] = [
  { id: 'hermes', name: 'Hermes', role: 'Chief of Staff', icon: Zap, color: '#00f0ff', status: 'idle', lastActive: '', tasksCompleted: 0 },
  { id: 'sage', name: 'Sage', role: 'X Content Specialist', icon: Globe, color: '#00ff88', status: 'idle', lastActive: '', tasksCompleted: 0 },
  { id: 'knox', name: 'Knox', role: 'Trading Ops', icon: Shield, color: '#ef4444', status: 'idle', lastActive: '', tasksCompleted: 0 },
  { id: 'nova', name: 'Nova', role: 'YouTube Strategy', icon: Mic, color: '#8b5cf6', status: 'idle', lastActive: '', tasksCompleted: 0 },
  { id: 'max', name: 'Max', role: 'Web Specialist', icon: Terminal, color: '#f59e0b', status: 'idle', lastActive: '', tasksCompleted: 0 },
  { id: 'pixel', name: 'Pixel', role: 'UI/UX Designer', icon: Brain, color: '#ec4899', status: 'idle', lastActive: '', tasksCompleted: 0 },
]

export default function AgentsPage() {
  const [agents, setAgents] = useState(AGENTS)
  const [selectedAgent, setSelectedAgent] = useState<string>('hermes')
  const [prompt, setPrompt] = useState('')
  const [sending, setSending] = useState(false)
  const [response, setResponse] = useState('')
  const [history, setHistory] = useState<{ role: string; content: string }[]>([])

  const loadAgentStates = useCallback(async () => {
    try {
      const res = await fetch('/api/hermes/health')
      const d = await res.json()
      const states = d.agents || {}
      setAgents(prev => prev.map(a => ({
        ...a,
        status: states[a.id]?.status || 'idle',
        lastActive: states[a.id]?.lastActive || '',
        tasksCompleted: states[a.id]?.tasksCompleted || 0
      })))
    } catch {}
  }, [])
  useEffect(() => { loadAgentStates() }, [loadAgentStates])

  const sendToAgent = async () => {
    if (!prompt.trim() || sending) return
    const agent = agents.find(a => a.id === selectedAgent)
    const userMsg = { role: 'user', content: prompt }
    setHistory(prev => [...prev, userMsg])
    setPrompt(''); setSending(true); setResponse('')

    try {
      const body: any = {
        prompt: `You are ${agent?.name} (${agent?.role}). Respond to this message from the operator: ${prompt}`,
        title: `${agent?.name}: ${prompt.slice(0, 50)}`,
        kind: 'chat'
      }
      const res = await fetch('/api/hermes/dispatch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const d = await res.json()
      const reqId = d.request?.id
      if (reqId) {
        // Poll
        let done = false; let attempts = 0
        while (!done && attempts < 30) {
          await new Promise(r => setTimeout(r, 3000))
          const rRes = await fetch(`/api/hermes/requests/${reqId}?_=${Date.now()}`)
          const rData = await rRes.json()
          const r = rData.request
          if (r?.status === 'done') {
            setResponse(r.result || '')
            setHistory(prev => [...prev, { role: 'assistant', content: r.result || '' }])
            done = true
          } else if (r?.status === 'failed') {
            setResponse('Error: ' + (r.error || 'Failed'))
            setHistory(prev => [...prev, { role: 'assistant', content: 'Error: ' + (r.error || 'Failed') }])
            done = true
          }
          attempts++
        }
      }
    } catch (e: any) { setResponse('Error: ' + e.message) } finally { setSending(false) }
  }

  const agent = agents.find(a => a.id === selectedAgent)

  return (
    <div className="h-[calc(100vh-8rem)] md:h-screen -mx-4 md:mx-0 md:rounded-2xl overflow-hidden border border-[var(--line)]/50 bg-[var(--bg)] shadow-2xl shadow-black/20 flex">
      {/* Agents sidebar */}
      <div className="w-64 border-r border-[var(--line)] flex flex-col shrink-0">
        <div className="p-4 border-b border-[var(--line)]">
          <h1 className="text-[14px] font-bold text-[var(--text)]">Agents</h1>
          <p className="text-[10px] text-[var(--text-4)] mt-1">Direct dispatch to specialized agents</p>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {agents.map(a => {
            const Icon = a.icon
            const isActive = selectedAgent === a.id
            return (
              <button key={a.id} onClick={() => { setSelectedAgent(a.id); setHistory([]); setResponse('') }}
                className={`w-full text-left p-3 rounded-xl mb-1 transition-all ${isActive ? 'bg-[var(--surface-2)] border border-[var(--line)]' : 'hover:bg-[var(--surface-2)]/50'}`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${a.color}20` }}>
                    <Icon className="w-5 h-5" style={{ color: a.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[13px] font-semibold text-[var(--text)]">{a.name}</span>
                      <div className={`w-2 h-2 rounded-full ${a.status === 'running' ? 'bg-yellow-400 animate-pulse' : 'bg-[var(--text-4)]'}`} />
                    </div>
                    <p className="text-[10px] text-[var(--text-4)] truncate">{a.role}</p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Agent header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--line)]">
          {agent && (
            <>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${agent.color}20` }}>
                <agent.icon className="w-5 h-5" style={{ color: agent.color }} />
              </div>
              <div>
                <h2 className="text-[14px] font-semibold text-[var(--text)]">{agent.name}</h2>
                <p className="text-[11px] text-[var(--text-4)]">{agent.role}</p>
              </div>
            </>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {history.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-3 border border-[var(--line)]" style={{ backgroundColor: `${agent?.color}10` }}>
                {agent && <agent.icon className="w-8 h-8" style={{ color: agent?.color }} />}
              </div>
              <h3 className="text-[14px] font-semibold text-[var(--text)] mb-1">Talk to {agent?.name}</h3>
              <p className="text-[12px] text-[var(--text-3)] max-w-xs">{agent?.role} agent ready. Send a message to dispatch.</p>
            </div>
          )}
          {history.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-[13px] ${msg.role === 'user' ? 'bg-[var(--accent)] text-black rounded-br-md' : 'bg-[var(--surface-2)] border border-[var(--line)] text-[var(--text)] rounded-bl-md'}`}>
                {msg.content}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 bg-[var(--surface-2)] border border-[var(--line)] rounded-2xl rounded-bl-md px-4 py-3">
                <Loader2 className="w-4 h-4 animate-spin text-[var(--accent)]" />
                <span className="text-[12px] text-[var(--text-3)]">{agent?.name} thinking...</span>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-4 border-t border-[var(--line)]">
          <div className="flex items-end gap-2">
            <div className="flex-1 relative">
              <textarea value={prompt} onChange={e => setPrompt(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendToAgent() } }}
                placeholder={`Message ${agent?.name}...`}
                rows={1}
                className="w-full px-4 py-3 rounded-2xl text-[13px] text-[var(--text)] bg-[var(--surface-1)] border border-[var(--line)] focus:outline-none focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20 placeholder-[var(--text-3)] resize-none transition-all"
                style={{ minHeight: '44px', maxHeight: '120px' }}
              />
            </div>
            <button onClick={sendToAgent} disabled={!prompt.trim() || sending}
              className="px-4 py-3 rounded-2xl text-[13px] font-semibold text-black hover:opacity-90 disabled:opacity-30 transition-all active:scale-95 shadow-lg shrink-0"
              style={{ backgroundColor: agent?.color || '#00f0ff' }}>
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
