"use client"
import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, Search, Trash2, X, Zap, Loader2, Check, CheckCheck, AlertCircle, GripVertical, ArrowRight } from 'lucide-react'

interface Task {
  id: string; board: string; title: string; assignee: string | null
  status: string; priority: number | null; result: string | null; updatedAt: string
}

const COLUMNS = [
  { id: 'todo', label: 'To Do', color: '#f59e0b' },
  { id: 'in-progress', label: 'In Progress', color: '#06b6d4' },
  { id: 'review', label: 'Review', color: '#8b5cf6' },
  { id: 'done', label: 'Done', color: '#10b981' },
]

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newStatus, setNewStatus] = useState('todo')
  const [dragging, setDragging] = useState<string | null>(null)

  const loadTasks = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/hermes/tasks')
      const d = await res.json()
      setTasks(d.tasks || [])
    } catch {} finally { setLoading(false) }
  }, [])
  useEffect(() => { loadTasks() }, [loadTasks])

  const createTask = async () => {
    if (!newTitle.trim()) return
    try {
      await fetch('/api/hermes/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: newTitle, status: newStatus }) })
      setNewTitle(''); setShowCreate(false); loadTasks()
    } catch {}
  }

  const moveTask = async (id: string, newStatus: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t))
    try {
      await fetch(`/api/hermes/tasks/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }) })
    } catch {}
  }

  const deleteTask = async (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id))
    try { await fetch(`/api/hermes/tasks/${id}`, { method: 'DELETE' }) } catch {}
  }

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDragging(id)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }

  const handleDrop = (e: React.DragEvent, status: string) => {
    e.preventDefault(); setDragging(null)
    if (dragging) moveTask(dragging, status)
  }

  return (
    <div className="h-[calc(100vh-8rem)] md:h-screen -mx-4 md:mx-0 md:rounded-2xl overflow-hidden border border-[var(--line)]/50 bg-[var(--bg)] shadow-2xl shadow-black/20">
      {/* Header */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b border-[var(--line)]">
        <div className="flex items-center gap-3">
          <h1 className="text-[15px] font-bold text-[var(--text)]">Tasks</h1>
          <span className="text-[10px] text-[var(--text-4)] bg-[var(--surface-2)] px-2 py-0.5 rounded-full">{tasks.length} tasks</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => loadTasks()} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-[var(--surface-2)] text-[var(--text-3)] hover:text-[var(--text)] transition-all">Refresh</button>
          <button onClick={() => setShowCreate(true)} className="text-[10px] px-2.5 py-1.5 rounded-lg bg-[var(--accent)] text-black font-medium flex items-center gap-1"><Plus className="w-3 h-3" /> New Task</button>
        </div>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
          <div className="bg-[var(--surface-1)] border border-[var(--line)] rounded-2xl p-6 w-full max-w-md mx-4">
            <h2 className="text-[14px] font-semibold text-[var(--text)] mb-3">Create Task</h2>
            <input autoFocus value={newTitle} onChange={e => setNewTitle(e.target.value)}
              placeholder="Task title..." onKeyDown={e => { if (e.key === 'Enter') createTask() }}
              className="w-full px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--line)] text-[13px] text-[var(--text)] placeholder-[var(--text-3)] focus:outline-none focus:border-[var(--accent)] mb-3" />
            <div className="flex gap-2 mb-4">
              {COLUMNS.map(col => (
                <button key={col.id} onClick={() => setNewStatus(col.id)}
                  className={`text-[11px] px-3 py-1.5 rounded-full border transition-all ${newStatus === col.id ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]' : 'border-[var(--line)] text-[var(--text-3)] hover:border-[var(--text-3)]'}`}>
                  {col.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowCreate(false)} className="text-[12px] px-3 py-1.5 rounded-lg bg-[var(--surface-2)] text-[var(--text-2)]">Cancel</button>
              <button onClick={createTask} disabled={!newTitle.trim()} className="text-[12px] px-3 py-1.5 rounded-lg bg-[var(--accent)] text-black font-medium disabled:opacity-30">Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Board */}
      <div className="flex gap-4 p-4 md:p-6 overflow-x-auto h-[calc(100%-56px)]">
        {COLUMNS.map(col => {
          const colTasks = tasks.filter(t => t.status === col.id)
          return (
            <div key={col.id} className="flex-1 min-w-[280px] flex flex-col"
              onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, col.id)}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: col.color }} />
                <h3 className="text-[12px] font-semibold text-[var(--text-2)] uppercase tracking-wider">{col.label}</h3>
                <span className="text-[10px] text-[var(--text-4)] bg-[var(--surface-2)] px-1.5 py-0.5 rounded-full">{colTasks.length}</span>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto">
                {colTasks.map(task => (
                  <div key={task.id} draggable onDragStart={(e) => handleDragStart(e, task.id)}
                    className={`bg-[var(--surface-2)] border border-[var(--line)] rounded-xl p-3 cursor-grab active:cursor-grabbing transition-all hover:border-[var(--accent)]/30 group ${dragging === task.id ? 'opacity-50 scale-95' : ''}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium text-[var(--text)] leading-snug">{task.title}</p>
                        {task.assignee && <p className="text-[10px] text-[var(--text-4)] mt-1">@{task.assignee}</p>}
                        {task.result && <p className="text-[10px] text-[var(--text-3)] mt-1 line-clamp-2">{task.result.slice(0, 100)}</p>}
                      </div>
                      <button onClick={() => deleteTask(task.id)} className="p-1 rounded hover:bg-[var(--down)]/20 text-[var(--text-4)] hover:text-[var(--down)] opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-3 h-3" /></button>
                    </div>
                    {/* quick move */}
                    <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {COLUMNS.filter(c => c.id !== col.id).slice(0, 2).map(c => (
                        <button key={c.id} onClick={() => moveTask(task.id, c.id)}
                          className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--surface-1)] text-[var(--text-4)] hover:text-[var(--text-3)] flex items-center gap-0.5">
                          <ArrowRight className="w-2.5 h-2.5" /> {c.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                {colTasks.length === 0 && (
                  <div className="border-2 border-dashed border-[var(--line)]/50 rounded-xl p-4 text-center">
                    <p className="text-[10px] text-[var(--text-4)]">Drop tasks here</p>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
