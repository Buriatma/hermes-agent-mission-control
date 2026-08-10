"use client";
import { useState, useEffect } from 'react';
import { BookOpen } from 'lucide-react';

interface Skill {
  name: string;
  path: string;
  description?: string;
}

export default function SkillsPage() {
  const [builtin, setBuiltin] = useState<Skill[]>([]);
  const [custom, setCustom] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/hermes/skills')
      .then(r => r.json())
      .then(d => {
        setBuiltin(d.builtin || []);
        setCustom(d.custom || []);
        setLoading(false);
      })
      .catch(e => { console.error("Failed to load skills", e); setLoading(false); });
  }, []);

  const filteredBuiltin = builtin.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));
  const filteredCustom = custom.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="p-6 text-[var(--text-3)]">Loading skills...</div>;

  return (
    <div className="h-full flex flex-col p-4 md:p-6 gap-6">
      <div className="flex items-center justify-between shrink-0">
        <h1 className="text-xl font-bold">Skills Manager</h1>
        <input 
          value={search} 
          onChange={e => setSearch(e.target.value)}
          placeholder="Search..."
          className="px-3 py-1.5 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-sm w-40 focus:border-[var(--accent)]"
        />
      </div>

      {/* Custom Skills */}
      <section>
        <h2 className="text-sm font-semibold text-[var(--text-3)] uppercase tracking-wider mb-3">Custom Skills ({filteredCustom.length})</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredCustom.map(skill => (
            <SkillCard key={skill.name} skill={skill} source="custom" />
          ))}
          {filteredCustom.length === 0 && (
            <p className="text-xs text-[var(--text-4)]">No custom skills found.</p>
          )}
        </div>
      </section>

      {/* Built-in Skills */}
      <section>
        <h2 className="text-sm font-semibold text-[var(--text-3)] uppercase tracking-wider mb-3">Built-in Skills ({filteredBuiltin.length})</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredBuiltin.map(skill => (
            <SkillCard key={skill.name} skill={skill} source="builtin" />
          ))}
        </div>
      </section>
    </div>
  );
}

function SkillCard({ skill, source }: { skill: Skill; source: 'builtin' | 'custom' }) {
  return (
    <div className="rounded-lg border border-[var(--line)] p-3 cursor-pointer hover:bg-[var(--surface-1)] transition-colors">
      <div className="flex items-center justify-between mb-2">
        <span className="font-medium text-sm text-[var(--text)]">{skill.name}</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded ${source === 'custom' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-slate-500/10 text-slate-400'}`}>
          {source}
        </span>
      </div>
      <p className="text-xs text-[var(--text-3)] line-clamp-2">{skill.description || 'No description available.'}</p>
      <div className="mt-2 text-[10px] text-[var(--text-4)] font-mono truncate">{skill.path}</div>
    </div>
  );
}
