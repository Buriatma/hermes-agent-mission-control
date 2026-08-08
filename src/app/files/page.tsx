"use client"
import { useState, useEffect } from "react"
import { Folder, FileText, Search, ChevronRight, FileCode, Settings, BookOpen, ArrowLeft, ArrowUp, Edit3, Save, X, FolderOpen } from "lucide-react"

interface FileItem { name: string; path: string; type: "file" | "dir"; size: number; updatedAt: string; parent?: string | null }
interface FileContent { name: string; path: string; type: string; size: number; content: string }

const CAT_ICONS: Record<string, any> = { obsidian: BookOpen, scripts: FileCode, config: Settings, default: FileText }

function formatSize(bytes: number): string {
  if (!bytes && bytes !== 0) return "—"
  if (bytes === 0) return "0 B"
  const units = ["B", "KB", "MB", "GB"]
  let i = 0
  let size = bytes
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++ }
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60000) return "just now"
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined })
}

function getParentPath(path: string): string {
  const idx = path.lastIndexOf("/")
  return idx > 0 ? path.slice(0, idx) : ""
}

function getBreadcrumbs(currentPath: string): { label: string; path: string }[] {
  const crumbs: { label: string; path: string }[] = [{ label: "VPS Root", path: "" }]
  if (!currentPath) return crumbs
  const parts = currentPath.split("/").filter(Boolean)
  let accum = ""
  for (const part of parts) {
    accum = accum ? `${accum}/${part}` : part
    crumbs.push({ label: part, path: accum })
  }
  return crumbs
}

export default function FilesPage() {
  const [files, setFiles] = useState<FileItem[]>([])
  const [currentPath, setCurrentPath] = useState<string>("")
  const [selectedFile, setSelectedFile] = useState<FileContent | null>(null)
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editContent, setEditContent] = useState("")
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    setLoading(true)
    const qs = currentPath ? `?parent=${encodeURIComponent(currentPath)}` : ""
    fetch(`/api/hermes/files${qs}`)
      .then(r => r.json())
      .then(d => {
        const items = (d.files || []) as FileItem[]
        setFiles(items)
        setLoading(false)
      })
      .catch(() => { setFiles([]); setLoading(false) })
  }, [currentPath])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Backspace" && !editing && document.activeElement === document.body) {
        e.preventDefault()
        setCurrentPath(getParentPath(currentPath))
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [currentPath, editing])

  const openFile = async (p: string) => {
    setLoading(true)
    setSelectedFile(null)
    setEditing(false)
    try {
      const r = await fetch(`/api/hermes/files?path=${encodeURIComponent(p)}`)
      const d = await r.json()
      setSelectedFile(d)
      setEditContent(d.content || "")
    } catch { /* ignore */ }
    setLoading(false)
    setSidebarOpen(false)
  }

  const saveFile = async () => {
    if (!selectedFile) return
    setSaving(true)
    try {
      const r = await fetch("/api/hermes/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: selectedFile.path, content: editContent }),
      })
      const d = await r.json()
      if (r.ok) {
        setSelectedFile({ ...selectedFile, content: editContent })
        setEditing(false)
      } else {
        alert(d.error || "Failed to save")
      }
    } catch { alert("Save failed") }
    setSaving(false)
  }

  const crumbs = getBreadcrumbs(currentPath)
  const dirCount = files.filter(f => f.type === "dir").length
  const fileCount = files.filter(f => f.type === "file").length
  const filtered = files.filter(f => !search || f.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="flex h-[calc(100vh-3rem)] bg-[var(--bg)] text-[var(--text)] relative overflow-hidden">
      {/* Mobile sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <div className={`fixed md:relative inset-y-0 left-0 z-50 md:z-auto w-72 md:w-64 border-r border-[var(--line)] flex flex-col bg-[var(--bg)] md:bg-transparent transform transition-transform duration-200 ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}>
        <div className="p-3 border-b border-[var(--line)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-[var(--text-3)] uppercase tracking-wider">VPS Files</span>
            <button onClick={() => { setCurrentPath(""); setSelectedFile(null); setSidebarOpen(false) }}
              className="text-[10px] px-2.5 py-1.5 rounded-lg bg-[var(--accent)] text-black font-semibold hover:opacity-90">
              Root
            </button>
          </div>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Filter files..."
            className="w-full px-3 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-sm text-[var(--text)] placeholder-[var(--text-3)] focus:outline-none focus:border-[var(--accent)]" />
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {loading && <div className="space-y-2 p-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-10 bg-[var(--surface-2)] rounded-lg animate-pulse" />)}</div>}
          {filtered.map(f => (
            <button key={f.path} onClick={() => f.type === "dir" ? setCurrentPath(f.path) : openFile(f.path)}
              className={`w-full text-left p-2 rounded-lg transition-all flex items-center gap-2 ${selectedFile?.path === f.path ? "bg-[var(--accent)]/15 border border-[var(--accent)]/50" : "hover:bg-[var(--surface-2)] border border-transparent"}`}>
              {f.type === "dir" ? <Folder className="w-4 h-4 text-[var(--accent)] shrink-0" /> : <FileText className="w-4 h-4 text-[var(--text-3)] shrink-0" />}
              <div className="min-w-0 flex-1">
                <div className="text-[13px] truncate">{f.name}</div>
                <div className="text-[10px] text-[var(--text-3)]">{f.type === "dir" ? `${dirCount} items` : formatSize(f.size)}</div>
              </div>
              {f.type === "file" && <span className="text-[10px] text-[var(--text-3)] shrink-0">{formatDate(f.updatedAt)}</span>}
            </button>
          ))}
          {!loading && filtered.length === 0 && (
            <div className="text-center py-8 text-[var(--text-3)] text-sm">
              {search ? "No files match" : "Folder is empty"}
            </div>
          )}
        </div>
        <div className="p-3 border-t border-[var(--line)] text-[10px] text-[var(--text-3)]">
          {dirCount} dirs · {fileCount} files
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <div className="flex items-center gap-2 px-3 md:px-4 py-2.5 border-b border-[var(--line)] shrink-0 bg-[var(--bg)]/80 backdrop-blur-md z-10">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-[var(--text-3)] hover:text-[var(--text)] p-1.5 rounded-lg hover:bg-[var(--surface-2)] md:hidden">
            <FolderOpen className="w-5 h-5" />
          </button>
          {selectedFile ? (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <button onClick={() => { setSelectedFile(null); setEditing(false) }} className="text-[var(--text-3)] hover:text-[var(--text)] p-1 rounded-lg hover:bg-[var(--surface-2)]">
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{selectedFile.name}</div>
                <div className="text-[10px] text-[var(--text-3)]">{selectedFile.path} · {formatSize(selectedFile.size)}</div>
              </div>
              {!editing ? (
                <button onClick={() => { setEditing(true); setEditContent(selectedFile.content || "") }}
                  className="text-[10px] px-2.5 py-1.5 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-[var(--text-3)] hover:text-[var(--text)] hover:border-[var(--accent)] flex items-center gap-1.5">
                  <Edit3 className="w-3 h-3" /> Edit
                </button>
              ) : (
                <div className="flex gap-1.5">
                  <button onClick={saveFile} disabled={saving}
                    className="text-[10px] px-2.5 py-1.5 rounded-lg bg-[var(--accent)] text-black font-semibold hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5">
                    <Save className="w-3 h-3" /> {saving ? "Saving..." : "Save"}
                  </button>
                  <button onClick={() => { setEditing(false); setEditContent(selectedFile.content || "") }}
                    className="text-[10px] px-2.5 py-1.5 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-[var(--text-3)] hover:text-[var(--text)]">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-1">
              <button onClick={() => setCurrentPath(getParentPath(currentPath))} className="text-[var(--text-3)] hover:text-[var(--text)] p-1.5 rounded-lg hover:bg-[var(--surface-2)]">
                <ArrowUp className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1 text-sm flex-wrap">
                {crumbs.map((crumb, i) => (
                  <span key={i} className="flex items-center gap-1">
                    {i > 0 && <ChevronRight className="w-3 h-3 text-[var(--text-4)]" />}
                    {i < crumbs.length - 1 ? (
                      <button onClick={() => setCurrentPath(crumb.path)} className="hover:text-[var(--text)] text-[var(--text-3)]">
                        {crumb.label}
                      </button>
                    ) : (
                      <span className="text-[var(--text)] font-medium">{crumb.label}</span>
                    )}
                  </span>
                ))}
              </div>
              <span className="text-[10px] text-[var(--text-3)] ml-auto hidden md:block">
                {dirCount} dirs · {fileCount} files
              </span>
            </div>
          )}
        </div>

        {selectedFile ? (
          <div className="flex-1 overflow-hidden flex flex-col">
            {editing ? (
              <textarea
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                className="flex-1 w-full p-4 text-[13px] font-mono bg-[var(--surface-1)] text-[var(--text)] border-none focus:outline-none resize-none"
                style={{ minHeight: "200px" }}
              />
            ) : (
              <pre className="flex-1 overflow-auto p-4 text-[13px] font-mono whitespace-pre-wrap leading-relaxed text-[var(--text-2)] bg-[var(--surface-1)]">
                {selectedFile.content || <span className="text-[var(--text-3)] italic">Empty file</span>}
              </pre>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-2 md:p-4">
            {loading ? (
              <div className="space-y-2">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-12 bg-[var(--surface-2)] rounded-lg animate-pulse" />)}</div>
            ) : filtered.length === 0 ? (
              <div className="flex items-center justify-center h-full text-[var(--text-3)]">
                <div className="text-center">
                  <FolderOpen className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">{search ? "No files match your filter" : "Folder is empty"}</p>
                </div>
              </div>
            ) : (
              <div className="max-w-4xl space-y-1">
                {filtered.map(f => (
                  <button key={f.path} onClick={() => f.type === "dir" ? setCurrentPath(f.path) : openFile(f.path)}
                    className="w-full text-left p-3 rounded-xl hover:bg-[var(--surface-2)] flex items-center gap-3 transition-all group border border-transparent hover:border-[var(--line)]">
                    {f.type === "dir" ? <Folder className="w-5 h-5 text-[var(--accent)] shrink-0" /> : <FileText className="w-5 h-5 text-[var(--text-3)] shrink-0 group-hover:text-[var(--text)]" />}
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium truncate">{f.name}</div>
                      <div className="text-[10px] text-[var(--text-3)]">{f.type === "dir" ? "Folder" : formatSize(f.size)}</div>
                    </div>
                    <div className="text-[10px] text-[var(--text-3)] hidden md:block">{formatDate(f.updatedAt)}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
