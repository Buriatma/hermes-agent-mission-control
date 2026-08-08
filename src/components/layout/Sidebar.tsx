import type { SessionSummary } from '@/lib/hermes/types'

interface SidebarProps {
  sessions: SessionSummary[]
  activeId: string
  onSelect: (id: string) => void
  onCreateNew: () => void
  onClose?: () => void
}

export function Sidebar({ sessions, activeId, onSelect, onCreateNew, onClose }: SidebarProps) {
  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-[var(--line)]">
        <h2 className="font-semibold text-[var(--text)]">Sessions</h2>
        <button 
          onClick={onCreateNew}
          className="mt-2 w-full px-3 py-2 rounded-lg bg-[var(--accent)] text-black text-sm font-medium hover:opacity-90 transition-opacity"
        >
          + New Chat
        </button>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2">
        {sessions.length === 0 ? (
          <div className="text-center py-8 text-[var(--text-3)] text-sm">
            No sessions yet
          </div>
        ) : (
          sessions.map(s => (
            <button
              key={s.id}
              onClick={() => { onSelect(s.id); onClose?.() }}
              className={`w-full text-left px-3 py-2 rounded-lg mb-1 text-sm transition-colors ${
                s.id === activeId 
                  ? 'bg-[var(--surface-2)] text-[var(--accent)] border border-[var(--accent)]' 
                  : 'text-[var(--text-2)] hover:bg-[var(--surface-2)]/50'
              }`}
            >
              <div className="truncate font-medium">{s.title || s.preview.slice(0, 30) || 'Untitled'}</div>
              <div className="text-xs text-[var(--text-3)] mt-0.5">
                {new Date(s.started_at * 1000).toLocaleDateString()} · {s.message_count} msgs
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
