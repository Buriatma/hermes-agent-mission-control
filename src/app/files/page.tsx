"use client";
import { useState, useEffect } from "react";
import { Folder, FileText, Search, ChevronRight, FileCode, Settings, BookOpen } from "lucide-react";

interface FileItem { name: string; path: string; type: "file" | "dir"; size: number; updatedAt: string }
interface FileContent { name: string; path: string; type: string; size: number; content: string }

const CAT_ICONS: Record<string, any> = { obsidian: BookOpen, scripts: FileCode, config: Settings, default: FileText };

export default function FilesPage() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [currentPath, setCurrentPath] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<FileContent | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const qs = currentPath ? `?parent=${encodeURIComponent(currentPath)}` : "";
    fetch(`/api/hermes/files${qs}`)
      .then(r => r.json())
      .then(d => { setFiles(d.files || []); setLoading(false); })
      .catch(() => { setFiles([]); setLoading(false); });
  }, [currentPath]);

  const openFile = async (p: string) => {
    const r = await fetch(`/api/hermes/files?path=${encodeURIComponent(p)}`);
    const d = await r.json();
    setSelectedFile(d);
  };

  const filtered = files.filter(f => !search || f.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex h-[calc(100vh-3rem)] bg-[var(--bg)] text-[var(--text)]">
      {/* Sidebar */}
      <div className="w-64 border-r border-[var(--line)] p-3 flex flex-col shrink-0 max-md:hidden">
        <div className="eyebrow mb-3">Locations</div>
        {["", "obsidian-vault/hermes", "home/hermes-agent-mission-control/hermes-bridge"].map((p, i) => (
          <button key={i} onClick={() => { setCurrentPath(p); setSelectedFile(null); }}
            className={`w-full text-left px-3 py-2 rounded-lg text-[13px] mb-1 transition-colors ${
              currentPath === p ? "bg-[var(--accent)] text-black font-medium" : "text-[var(--text-2)] hover:bg-[var(--surface-2)]"
            }`}>
            {p || "VPS Root (/opt/data)"}
          </button>
        ))}
        <div className="mt-4">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter..."
            className="w-full px-3 py-1.5 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-[13px] text-[var(--text)] focus:outline-none focus:border-[var(--accent)]" />
        </div>
        <div className="mt-auto text-[10px] text-[var(--text-4)] pt-3">{files.length} items · synced from VPS</div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedFile ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-3 border-b border-[var(--line)] flex items-center gap-3">
              <button onClick={() => setSelectedFile(null)} className="text-xs text-[var(--accent)] hover:underline">← Back</button>
              <span className="text-sm font-medium">{selectedFile.name}</span>
              <span className="text-[10px] text-[var(--text-3)] ml-auto">{(selectedFile.size / 1024).toFixed(1)} KB</span>
            </div>
            <pre className="flex-1 overflow-auto p-4 text-[13px] font-mono whitespace-pre-wrap leading-relaxed text-[var(--text-2)] bg-[var(--surface-1)]">
              {selectedFile.content}
            </pre>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-sm text-[var(--text-3)]">
                <span>/opt/data/</span>
                {currentPath.split("/").filter(Boolean).map((seg, i) => (
                  <span key={i}>
                    <ChevronRight className="w-3 h-3 inline" />
                    <button onClick={() => setCurrentPath(currentPath.split("/").slice(0, i + 1).join("/"))}
                      className="hover:text-[var(--text)]">{seg}</button>
                  </span>
                ))}
              </div>
              <span className="text-[10px] text-[var(--text-3)]">{files.length} items</span>
            </div>
            {loading ? (
              <div className="space-y-2">{[...Array(8)].map((_, i) => <div key={i} className="h-10 rounded-lg bg-[var(--surface-2)] sk" />)}</div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center text-[var(--text-3)] text-sm">No files found</div>
            ) : (
              <div className="space-y-0.5">
                {filtered.map(f => (
                  <button key={f.path} onClick={() => f.type === "dir" ? setCurrentPath(f.path) : openFile(f.path)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left hover:bg-[var(--surface-2)] transition-colors group">
                    <div className="w-8 h-8 rounded-md bg-[var(--surface-2)] flex items-center justify-center text-[var(--text-3)] shrink-0">
                      {f.type === "dir" ? <Folder className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] text-[var(--text)] truncate">{f.name}</div>
                      <div className="text-[10px] text-[var(--text-3)] truncate">{f.path}</div>
                    </div>
                    {f.type === "file" && <span className="text-[10px] text-[var(--text-3)] shrink-0">{(f.size / 1024).toFixed(1)} KB</span>}
                    <ChevronRight className="w-4 h-4 text-[var(--text-4)] shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
