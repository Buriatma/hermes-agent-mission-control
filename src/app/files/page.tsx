"use client";
import { useState, useEffect } from "react";
import { Folder, FileText, Search, ChevronRight, FileCode, Settings, BookOpen, ArrowLeft, ArrowUp } from "lucide-react";

interface FileItem { name: string; path: string; type: "file" | "dir"; size: number; updatedAt: string }
interface FileContent { name: string; path: string; type: string; size: number; content: string }

const CAT_ICONS: Record<string, any> = { obsidian: BookOpen, scripts: FileCode, config: Settings, default: FileText };

function formatSize(bytes: number): string {
  if (bytes === 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined });
}

function getParentPath(path: string): string {
  const idx = path.lastIndexOf("/");
  return idx > 0 ? path.slice(0, idx) : "";
}

function getBreadcrumbs(currentPath: string): { label: string; path: string }[] {
  const crumbs: { label: string; path: string }[] = [{ label: "/opt/data", path: "" }];
  if (!currentPath) return crumbs;
  const parts = currentPath.split("/").filter(Boolean);
  let accum = "";
  for (const part of parts) {
    accum = accum ? `${accum}/${part}` : part;
    crumbs.push({ label: part, path: accum });
  }
  return crumbs;
}

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

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Backspace" && !selectedFile && document.activeElement === document.body) {
        setCurrentPath(getParentPath(currentPath));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [currentPath, selectedFile]);

  const openFile = async (p: string) => {
    const r = await fetch(`/api/hermes/files?path=${encodeURIComponent(p)}`);
    const d = await r.json();
    setSelectedFile(d);
  };

  const crumbs = getBreadcrumbs(currentPath);
  const filtered = files.filter(f => !search || f.name.toLowerCase().includes(search.toLowerCase()));
  const dirCount = filtered.filter(f => f.type === "dir").length;
  const fileCount = filtered.filter(f => f.type === "file").length;

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
        <div className="mt-auto text-[10px] text-[var(--text-4)] pt-3">
          {dirCount} dirs · {fileCount} files
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedFile ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-3 border-b border-[var(--line)] flex items-center gap-3">
              <button onClick={() => setSelectedFile(null)} className="text-xs text-[var(--accent)] hover:underline flex items-center gap-1">
                <ArrowLeft className="w-3 h-3" /> Back
              </button>
              <span className="text-sm font-medium">{selectedFile.name}</span>
              <span className="text-[10px] text-[var(--text-3)] ml-auto">{formatSize(selectedFile.size)}</span>
            </div>
            <pre className="flex-1 overflow-auto p-4 text-[13px] font-mono whitespace-pre-wrap leading-relaxed text-[var(--text-2)] bg-[var(--surface-1)]">
              {selectedFile.content}
            </pre>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4">
            {/* Breadcrumbs + nav */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-1 text-sm">
                {currentPath && (
                  <button
                    onClick={() => setCurrentPath(getParentPath(currentPath))}
                    className="p-1 rounded-md hover:bg-[var(--surface-2)] text-[var(--text-3)] transition-colors"
                    title="Go up one level">
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                )}
                {crumbs.map((crumb, i) => (
                  <span key={i} className="flex items-center gap-1">
                    {i > 0 && <ChevronRight className="w-3 h-3 text-[var(--text-4)]" />}
                    {i < crumbs.length - 1 ? (
                      <button
                        onClick={() => { setCurrentPath(crumb.path); }}
                        className="hover:text-[var(--text)] text-[var(--text-3)] transition-colors">
                        {crumb.label}
                      </button>
                    ) : (
                      <span className="text-[var(--text)] font-medium">{crumb.label}</span>
                    )}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-[var(--text-3)]">
                  {dirCount > 0 && `${dirCount} dir${dirCount !== 1 ? "s" : ""}`}
                  {dirCount > 0 && fileCount > 0 && " · "}
                  {fileCount > 0 && `${fileCount} file${fileCount !== 1 ? "s" : ""}`}
                </span>
              </div>
            </div>

            {loading ? (
              <div className="space-y-2">{[...Array(8)].map((_, i) => <div key={i} className="h-10 rounded-lg bg-[var(--surface-2)] animate-pulse" />)}</div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center text-[var(--text-3)] text-sm">
                {search ? "No matches" : "Folder is empty"}
              </div>
            ) : (
              <div className="space-y-0.5">
                {filtered.map(f => (
                  <button key={f.path} onClick={() => f.type === "dir" ? setCurrentPath(f.path) : openFile(f.path)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left hover:bg-[var(--surface-2)] transition-colors group">
                    <div className="w-8 h-8 rounded-md bg-[var(--surface-2)] flex items-center justify-center text-[var(--text-3)] shrink-0 group-hover:text-[var(--text)] transition-colors">
                      {f.type === "dir" ? <Folder className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] text-[var(--text)] truncate group-hover:text-[var(--accent)] transition-colors">{f.name}</div>
                      <div className="text-[10px] text-[var(--text-3)] truncate">{f.path}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[10px] text-[var(--text-3)]">{formatSize(f.size)}</div>
                      <div className="text-[10px] text-[var(--text-4)]">{formatDate(f.updatedAt)}</div>
                    </div>
                    {f.type === "dir" && <ChevronRight className="w-4 h-4 text-[var(--text-4)] shrink-0 group-hover:text-[var(--text-2)]" />}
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
