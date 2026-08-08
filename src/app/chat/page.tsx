"use client"
import { useState, useEffect, useRef } from 'react'
import { api } from '@/lib/hermes/client'
import type { Message, SessionSummary } from '@/lib/hermes/types'
import { SessionDetail } from '@/components/chat/SessionDetail'
import { Sidebar } from '@/components/layout/Sidebar'

const AVAILABLE_MODELS = [
  { id: "best-long-context", name: "GLM-4.7", provider: "9router" },
  { id: "custom:9router", name: "9Router Router", provider: "9router" },
  { id: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet", provider: "Anthropic" },
  { id: "gpt-4o", name: "GPT-4o", provider: "OpenAI" },
]

interface ChatSession extends SessionSummary {
  messages: Message[]
}

export default function ChatPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string>('')
  const [input, setInput] = useState('')
  const [currentModel, setCurrentModel] = useState(AVAILABLE_MODELS[0].id)
  const [loading, setLoading] = useState(false)
  const [showSidebar, setShowSidebar] = useState(false)
  const [showModelPicker, setShowModelPicker] = useState(false)
  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0]

  // Load sessions from DB on mount
  useEffect(() => {
    loadSessions()
  }, [])

  const loadSessions = async () => {
    try {
      const data = await api.sessions({ limit: 50 })
      const mappedSessions: ChatSession[] = data.requests
        .filter((r: any) => r.kind === 'chat' || r.kind === 'oneshot')
        .map((r: any) => ({
          id: r.id,
          source: r.origin || 'web',
          model: null,
          title: r.title || r.prompt?.slice(0, 50) || 'Untitled',
          started_at: r.createdAt ? Math.floor(new Date(r.createdAt).getTime() / 1000) : Math.floor(Date.now() / 1000),
          ended_at: r.finishedAt ? Math.floor(new Date(r.finishedAt).getTime() / 1000) : null,
          end_reason: r.status === 'done' ? 'completed' : r.status === 'failed' ? 'failed' : null,
          message_count: 2,
          tool_call_count: 0,
          input_tokens: 0,
          output_tokens: 0,
          cache_read_tokens: 0,
          cache_write_tokens: 0,
          reasoning_tokens: 0,
          estimated_cost_usd: null,
          actual_cost_usd: null,
          billing_provider: null,
          preview: r.result || r.prompt || '',
          last_active: r.updatedAt ? Math.floor(new Date(r.updatedAt).getTime() / 1000) : null,
          messages: [
            ...(r.prompt ? [{
              id: 1,
              session_id: r.id,
              role: 'user',
              content: r.prompt,
              timestamp: r.createdAt ? Math.floor(new Date(r.createdAt).getTime() / 1000) : 0,
            }] : []),
            ...(r.result ? [{
              id: 2,
              session_id: r.id,
              role: 'assistant',
              content: r.result,
              timestamp: r.finishedAt ? Math.floor(new Date(r.finishedAt).getTime() / 1000) : 0,
            }] : []),
            ...(r.error && !r.result ? [{
              id: 2,
              session_id: r.id,
              role: 'assistant',
              content: `Error: ${r.error}`,
              timestamp: r.finishedAt ? Math.floor(new Date(r.finishedAt).getTime() / 1000) : 0,
            }] : []),
          ],
        }))
      setSessions(mappedSessions)
      if (mappedSessions.length > 0 && !activeSessionId) {
        setActiveSessionId(mappedSessions[0].id)
      }
    } catch (e) {
      console.error('Failed to load sessions:', e)
    }
  }

  const createNewSession = () => {
    const newSession: ChatSession = {
      id: 'new-' + Date.now(),
      source: 'web',
      model: currentModel,
      title: 'New Chat',
      started_at: Math.floor(Date.now() / 1000),
      ended_at: null,
      end_reason: null,
      message_count: 0,
      tool_call_count: 0,
      input_tokens: 0,
      output_tokens: 0,
      cache_read_tokens: 0,
      cache_write_tokens: 0,
      reasoning_tokens: 0,
      estimated_cost_usd: null,
      actual_cost_usd: null,
      billing_provider: null,
      preview: '',
      last_active: null,
      messages: [],
    }
    setSessions(prev => [newSession, ...prev])
    setActiveSessionId(newSession.id)
  }

  const sendMessage = async () => {
    if (!input.trim() || loading) return
    const targetId = activeSessionId || 'new-' + Date.now()
    const promptText = input

    const userMessage: Message = {
      id: Date.now(),
      session_id: targetId,
      role: 'user',
      content: promptText,
      timestamp: Math.floor(Date.now() / 1000),
    }

    // If no active session yet (new session), create it
    if (!activeSessionId) {
      const newSession: ChatSession = {
        id: targetId,
        source: 'web',
        model: currentModel,
        title: promptText.slice(0, 50),
        started_at: Math.floor(Date.now() / 1000),
        ended_at: null,
        end_reason: null,
        message_count: 0,
        tool_call_count: 0,
        input_tokens: 0,
        output_tokens: 0,
        cache_read_tokens: 0,
        cache_write_tokens: 0,
        reasoning_tokens: 0,
        estimated_cost_usd: null,
        actual_cost_usd: null,
        billing_provider: null,
        preview: '',
        last_active: null,
        messages: [userMessage],
      }
      setSessions(prev => [newSession, ...prev])
      setActiveSessionId(targetId)
    } else {
      setSessions(prev => prev.map(s =>
        s.id === targetId
          ? { ...s, messages: [...s.messages, userMessage] }
          : s
      ))
    }

    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/hermes/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptText,
          title: promptText.slice(0, 50),
          kind: 'chat',
          sideEffecting: false,
        }),
      })

      if (!res.ok) throw new Error('Dispatch failed')
      const json = await res.json()
      const reqId = json.request?.id
      if (!reqId) throw new Error('No request ID returned')

      // Add thinking placeholder
      const thinkingMsg: Message = {
        id: Date.now() + 0.5,
        session_id: targetId,
        role: 'assistant',
        content: 'Executing...',
        timestamp: Math.floor(Date.now() / 1000),
      }
      setSessions(prev => prev.map(s =>
        s.id === targetId
          ? { ...s, messages: [...s.messages, thinkingMsg] }
          : s
      ))

      // Poll for status
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/hermes/requests/${reqId}`)
          if (!statusRes.ok) return
          const data = await statusRes.json()
          const status = data.request?.status

          if (status === 'done' || status === 'failed') {
            clearInterval(pollInterval)
            setLoading(false)

            const streamRes = await fetch(`/api/hermes/requests/${reqId}/stream`)
            let resultText = status === 'done' ? data.request?.result : (data.request?.error || 'Execution failed')
            if (streamRes.ok) {
              const text = await streamRes.text()
              if (text) {
                try {
                  const parsed = JSON.parse(text)
                  if (parsed.content) resultText = parsed.content
                } catch { resultText = text }
              }
            }

            const assistantMessage: Message = {
              id: Date.now() + 1,
              session_id: targetId,
              role: 'assistant',
              content: resultText || 'No response',
              timestamp: Math.floor(Date.now() / 1000),
            }

            setSessions(prev => prev.map(s => {
              if (s.id !== targetId) return s
              const msgs = s.messages.map(m =>
                m.id === thinkingMsg.id ? assistantMessage : m
              )
              return {
                ...s,
                messages: msgs,
                message_count: msgs.length,
                title: s.title === 'New Chat' ? promptText.slice(0, 50) : s.title,
                preview: resultText || s.preview,
                last_active: Math.floor(Date.now() / 1000),
              }
            }))
          }
        } catch (e) {
          console.error('Poll error:', e)
          clearInterval(pollInterval)
          setLoading(false)
        }
      }, 2000)

    } catch (e) {
      console.error('Send error:', e)
      setLoading(false)
      const errorMsg: Message = {
        id: Date.now() + 1,
        session_id: targetId,
        role: 'assistant',
        content: 'Error: Could not send message. Check connection.',
        timestamp: Math.floor(Date.now() / 1000),
      }
      setSessions(prev => prev.map(s =>
        s.id === targetId
          ? { ...s, messages: [...s.messages, errorMsg] }
          : s
      ))
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex h-screen bg-[var(--bg)] text-[var(--text)]">
      {/* Mobile sidebar overlay */}
      {showSidebar && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setShowSidebar(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div className="absolute left-0 top-0 bottom-0 w-64 bg-[var(--surface-1)] border-r border-[var(--line)]">
            <Sidebar
              sessions={sessions}
              activeId={activeSessionId}
              onSelect={setActiveSessionId}
              onCreateNew={createNewSession}
              onClose={() => setShowSidebar(false)}
            />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden lg:block w-64 border-r border-[var(--line)]">
        <Sidebar
          sessions={sessions}
          activeId={activeSessionId}
          onSelect={setActiveSessionId}
          onCreateNew={createNewSession}
        />
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--line)] bg-[var(--surface-1)]">
          <div className="flex items-center gap-3">
            <button onClick={() => setShowSidebar(true)} className="lg:hidden p-2 rounded hover:bg-[var(--surface-2)]">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div>
              <h1 className="font-semibold text-[var(--text)]">Hermes Chat</h1>
              <p className="text-xs text-[var(--text-3)]">{activeSession?.title || 'Start a conversation'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowModelPicker(!showModelPicker)}
              className="px-3 py-1.5 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-xs text-[var(--text-2)] hover:border-[var(--accent)] transition-colors"
            >
              {AVAILABLE_MODELS.find(m => m.id === currentModel)?.name || 'Model'}
            </button>
          </div>
        </div>

        {/* Model picker dropdown */}
        {showModelPicker && (
          <div className="absolute right-4 top-14 z-40 w-48 bg-[var(--surface-1)] border border-[var(--line)] rounded-lg shadow-xl">
            {AVAILABLE_MODELS.map(m => (
              <button
                key={m.id}
                onClick={() => { setCurrentModel(m.id); setShowModelPicker(false) }}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-[var(--surface-2)] ${currentModel === m.id ? 'text-[var(--accent)]' : 'text-[var(--text-2)]'}`}
              >
                {m.name}
                <span className="block text-xs text-[var(--text-3)]">{m.provider}</span>
              </button>
            ))}
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeSession?.messages && activeSession.messages.length > 0 ? (
            <SessionDetail
              sessionId={activeSessionId}
              session={activeSession}
              messages={activeSession.messages}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-[var(--text-3)]">
              <svg className="w-12 h-12 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              <p className="text-sm">Start a conversation with Hermes</p>
              <p className="text-xs mt-1">Type a message to get started</p>
            </div>
          )}
          {loading && (
            <div className="flex items-center gap-2 px-4 py-2 text-sm text-[var(--text-3)]">
              <div className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
              Hermes is thinking...
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="border-t border-[var(--line)] p-4 bg-[var(--surface-1)]">
          <div className="flex gap-2 max-w-4xl mx-auto">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              className="flex-1 bg-[var(--surface-2)] border border-[var(--line)] rounded-lg px-4 py-2 text-sm text-[var(--text)] placeholder-[var(--text-3)] focus:outline-none focus:border-[var(--accent)]"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              className="px-4 py-2 bg-[var(--accent)] text-black rounded-lg font-medium text-sm disabled:opacity-50 hover:opacity-90 transition-opacity"
            >
              Send
            </button>
          </div>
          <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
            {['Check status', 'List tasks', 'What time is it', 'Help'].map(cmd => (
              <button
                key={cmd}
                onClick={() => setInput(cmd)}
                className="px-2 py-1 rounded bg-[var(--surface-2)] text-[var(--text-3)] text-xs hover:text-[var(--text)] whitespace-nowrap"
              >
                {cmd}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
