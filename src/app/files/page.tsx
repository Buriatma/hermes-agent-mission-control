"use client";

import { useState } from "react";
import { Folder, FileText, Search, HardDrive, Download, ChevronRight, RefreshCw, FileCode, Database } from "lucide-react";
import { Panel, Button, Eyebrow, Pill } from "@/components/ui/kit";

interface FileItem {
  name: string;
  path: string;
  type: "file" | "dir";
  size?: string;
  updatedAt: string;
  category: "obsidian" | "logs" | "scripts" | "config";
}

export default function FileManagerPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>("obsidian");
  const [search, setSearch] = useState("");

  const files: FileItem[] = [
    { name: "Index.md", path: "/opt/data/obsidian-vault/hermes/Index.md", type: "file", size: "902 B", updatedAt: "Just now", category: "obsidian" },
    { name: "Infrastructure.md", path: "/opt/data/obsidian-vault/hermes/Infrastructure.md", type: "file", size: "1.3 KB", updatedAt: "Just now", category: "obsidian" },
    { name: "GlyteTech.md", path: "/opt/data/obsidian-vault/hermes/GlyteTech.md", type: "file", size: "1.0 KB", updatedAt: "Just now", category: "obsidian" },
    { name: "MissionControl.md", path: "/opt/data/obsidian-vault/hermes/MissionControl.md", type: "file", size: "1.3 KB", updatedAt: "Just now", category: "obsidian" },
    { name: "UserPreferences.md", path: "/opt/data/obsidian-vault/hermes/UserPreferences.md", type: "file", size: "986 B", updatedAt: "Just now", category: "obsidian" },
    { name: "auto-deploy-glytetech.sh", path: "/home/ubuntu/auto-deploy-glytetech.sh", type: "file", size: "450 B", updatedAt: "Yesterday", category: "scripts" },
    { name: "bridge.mjs", path: "/opt/data/home/hermes-agent-mission-control/hermes-bridge/bridge.mjs", type: "file", size: "12 KB", updatedAt: "Today", category: "scripts" },
    { name: "config.yaml", path: "/opt/data/config.yaml", type: "file", size: "4.2 KB", updatedAt: "Today", category: "config" },
  ];

  const filtered = files.filter(
    (f) =>
      (selectedCategory === "all" || f.category === selectedCategory) &&
      f.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Eyebrow>GlyteOS Storage</Eyebrow>
          <h1 className="text-[24px] font-semibold text-[var(--text)] tracking-[-0.02em]">
            File Manager
          </h1>
          <p className="text-[13px] text-[var(--text-3)]">
            Manage Obsidian memory notes, configuration files, and Hermes automation scripts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm">
            <RefreshCw className="w-4 h-4" />
            Refresh Sync
          </Button>
        </div>
      </div>

      {/* Categories & Search */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
          <Button
            size="sm"
            variant={selectedCategory === "obsidian" ? "primary" : "ghost"}
            onClick={() => setSelectedCategory("obsidian")}
          >
            <Database className="w-3.5 h-3.5" />
            Obsidian Vault
          </Button>
          <Button
            size="sm"
            variant={selectedCategory === "scripts" ? "primary" : "ghost"}
            onClick={() => setSelectedCategory("scripts")}
          >
            <FileCode className="w-3.5 h-3.5" />
            Scripts
          </Button>
          <Button
            size="sm"
            variant={selectedCategory === "config" ? "primary" : "ghost"}
            onClick={() => setSelectedCategory("config")}
          >
            <HardDrive className="w-3.5 h-3.5" />
            Config
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-3)]" />
          <input
            type="text"
            placeholder="Filter files..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full md:w-64 pl-9 pr-4 py-2 bg-[var(--surface-1)] text-[var(--text)] rounded-[8px] border border-[var(--line)] outline-none focus:border-[var(--accent)] text-[13px]"
          />
        </div>
      </div>

      {/* Files List */}
      <Panel className="p-0 overflow-hidden">
        <div className="divide-y divide-[var(--line)]">
          {filtered.map((file) => (
            <div
              key={file.path}
              className="p-4 flex items-center justify-between hover:bg-[var(--surface-2)]/50 transition-colors group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-[8px] bg-[var(--surface-2)] flex items-center justify-center text-[var(--accent)] shrink-0">
                  {file.type === "dir" ? <Folder className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                </div>
                <div className="min-w-0">
                  <h3 className="text-[14px] font-medium text-[var(--text)] truncate">{file.name}</h3>
                  <p className="text-[11px] text-[var(--text-3)] truncate">{file.path}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 md:gap-4 text-[12px] text-[var(--text-3)] shrink-0">
                <span className="hidden sm:inline">{file.size}</span>
                <span className="hidden sm:inline">{file.updatedAt}</span>
                <Pill tone="neutral" className="text-[10px] px-1.5 py-0">
                  {file.category}
                </Pill>
                <ChevronRight className="w-4 h-4 text-[var(--text-4)] group-hover:text-[var(--text-2)] transition-colors" />
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="p-8 text-center text-[var(--text-3)] text-[13px]">
              No files found in this category.
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}
