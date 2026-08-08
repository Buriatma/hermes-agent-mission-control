import { useState } from 'react'
import { api } from '../../lib/hermes/client'
import type { Message, SessionSummary } from '../../lib/hermes/types'

interface SessionDetailProps {
  sessionId: string
  session: SessionSummary
  messages: Message[]
}

export function SessionDetail({ sessionId, session, messages }: SessionDetailProps) {
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  
  const toggleSort = () => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
  }

  const sortedMessages = [...messages].sort((a, b) => {
    const timeA = new Date(a.timestamp * 1000).getTime()
    const timeB = new Date(b.timestamp * 1000).getTime()
    return sortOrder === 'asc' ? timeA - timeB : timeB - timeA
  })

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--line)]">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text)]">{session.title || sessionId.slice(0, 12)}</h2>
          <div className="flex gap-3 mt-1 text-xs text-[var(--text-3)]">
            <span>{session.model || 'unknown'}</span>
            <span>{messages.length} msgs</span>
            <span>{session.source}</span>
          </div>
        </div>
        <button onClick={toggleSort} className="px-2 py-1 rounded bg-[var(--surface-2)] text-[var(--text-2)] text-xs">
          {sortOrder === 'asc' ? '↑ Oldest first' : '↓ Newest first'}
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {sortedMessages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] p-3 rounded-lg ${
              msg.role === 'user' 
                ? 'bg-[var(--accent)] text-white' 
                : 'bg-[var(--surface-2)] text-[var(--text)] border border-[var(--line)]'
            }`}>
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              <span className="text-[10px] opacity-60 mt-1 block">
                {new Date(msg.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
