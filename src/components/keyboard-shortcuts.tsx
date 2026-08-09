"use client"
import { useEffect, useState } from 'react'
import { Command } from 'lucide-react'

export function KeyboardShortcuts() {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [commands, setCommands] = useState<{ name: string; desc: string }[]>([])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setOpen(v => !v); setQ('') }
      if (e.key === 'Escape') { setOpen(false); setQ('') }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (open) fetch('/api/hermes/commands').then(r => r.json()).then(d => setCommands(d.commands || [])).catch(() => setCommands([]))
  }, [open])

  if (!open) return null

  const filtered = commands.filter(c => c.name.includes(q.toLowerCase()) || c.desc.toLowerCase().includes(q.toLowerCase()))

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] pointer-events-none">
        <div className="bg-[var(--surface-1)] border border-[var(--accent)] rounded-xl shadow-lg w-full max-w-lg mx-4 overflow-hidden pointer-events-auto">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--line)]">
            <Command className="w-4 h-4 text-[var(--accent)]" />
            <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Type a command..."
              className="flex-1 bg-transparent text-sm text-[var(--text)] placeholder-[var(--text-3)] outline-none" />
            <span className="text-[10px] text-[var(--text-4)] bg-[var(--surface-2)] px-1.5 py-0.5 rounded">ESC</span>
          </div>
          <div className="max-h-64 overflow-auto p-1">
            {filtered.map(c => (
              <button key={c.name} onClick={() => { setOpen(false); setQ('') }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left hover:bg-[var(--surface-2)] transition-colors">
                <span className="text-xs font-mono text-[var(--accent)] bg-[var(--accent)]/10 px-2 py-0.5 rounded">{c.name}</span>
                <span className="text-xs text-[var(--text-2)]">{c.desc}</span>
              </button>
            ))}
            {filtered.length === 0 && <div className="text-center py-6 text-xs text-[var(--text-3)]">No commands found</div>}
          </div>
          <div className="flex items-center justify-between px-4 py-2 border-t border-[var(--line)] text-[10px] text-[var(--text-4)]">
            <span><kbd className="px-1 bg-[var(--surface-2)] rounded">⌘K</kbd> Toggle · <kbd className="px-1 bg-[var(--surface-2)] rounded">⌘N</kbd> New Chat</span>
          </div>
        </div>
      </div>
    </>
  )
}