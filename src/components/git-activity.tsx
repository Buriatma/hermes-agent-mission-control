"use client"
import { useEffect, useState } from 'react'
import { GitBranch } from 'lucide-react'

interface Commit { hash: string; message: string }

export function GitActivity(){
  const [commits,setCommits]=useState<Commit[]>([])
  useEffect(()=>{ fetch('/api/hermes/git').then(r=>r.json()).then(d=>setCommits(d.commits||[])).catch(()=>{}) },[])
  if(!commits.length) return null
  return(
    <div className="rounded-xl bg-[var(--surface-1)] border border-[var(--line)] p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-[var(--text)] mb-3">
        <GitBranch className="w-4 h-4 text-[var(--accent)]"/> Recent Commits
      </div>
      <div className="space-y-1 max-h-64 overflow-auto">
        {commits.map(c=>(
          <div key={c.hash} className="flex items-center gap-2 text-xs py-1.5 border-b border-[var(--line)]/20 last:border-0">
            <span className="font-mono text-[var(--accent)]">{c.hash}</span>
            <span className="text-[var(--text-2)] truncate">{c.message}</span>
          </div>
        ))}
      </div>
    </div>
  )
}