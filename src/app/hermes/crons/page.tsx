"use client";
import { useState, useEffect } from 'react';
import { Plus, Trash2, RefreshCw, Play } from 'lucide-react';

interface Job {
  id: string;
  status: string;
  name: string;
  schedule: string;
  nextRun: string | null;
  lastRun: string | null;
  prompt: string;
}

export default function CronsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newJob, setNewJob] = useState({ name: '', schedule: '', prompt: '' });

  const refresh = () => {
    setLoading(true);
    fetch('/api/hermes/crons')
      .then(r => r.json())
      .then(d => {
        setJobs(d.jobs || []);
        setLoading(false);
      })
      .catch(e => { setLoading(false); });
  };

  useEffect(() => { refresh(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/hermes/crons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'create', ...newJob })
    });
    setShowForm(false);
    setNewJob({ name: '', schedule: '', prompt: '' });
    refresh();
  };

  const deleteJob = async (id: string) => {
    if (!confirm('Delete this job?')) return;
    await fetch('/api/hermes/crons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: 'remove', id })
    });
    refresh();
  };

  const toggleJob = async (job: Job) => {
    await fetch('/api/hermes/crons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ op: job.status === 'active' ? 'pause' : 'resume', id: job.id })
    });
    refresh();
  };

  return (
    <div className="h-full flex flex-col p-4 md:p-6 gap-6">
      <div className="flex items-center justify-between shrink-0">
        <h1 className="text-xl font-bold">Scheduled Tasks</h1>
        <div className="flex gap-2">
          <button onClick={refresh} className="p-2 rounded-lg border border-[var(--line)] hover:bg-[var(--surface-2)]">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 px-3 py-2 bg-[var(--accent)] text-black rounded-lg font-medium text-sm">
            <Plus className="w-4 h-4" /> New Job
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="rounded-xl border border-[var(--accent)]/30 bg-[var(--surface-1)] p-4 space-y-3">
          <input placeholder="Job Name" value={newJob.name} onChange={e => setNewJob({...newJob, name: e.target.value})} className="w-full px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--line)] text-sm" required />
          <input placeholder="Schedule (e.g. '30m', 'every 2h', '0 9 * * *')" value={newJob.schedule} onChange={e => setNewJob({...newJob, schedule: e.target.value})} className="w-full px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--line)] text-sm font-mono" required />
          <textarea placeholder="Prompt to execute..." value={newJob.prompt} onChange={e => setNewJob({...newJob, prompt: e.target.value})} className="w-full px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--line)] text-sm min-h-[80px]" required />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-3 py-1.5 text-sm text-[var(--text-3)]">Cancel</button>
            <button type="submit" className="px-3 py-1.5 bg-[var(--accent)] text-black rounded-lg text-sm font-medium">Create Job</button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-[var(--text-4)]">Loading cron jobs...</p>
      ) : jobs.length === 0 ? (
        <p className="text-sm text-[var(--text-4)]">No scheduled tasks found.</p>
      ) : (
        <div className="space-y-3">
          {jobs.map(job => (
            <div key={job.id} className="rounded-xl border border-[var(--line)] bg-[var(--surface-1)] p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-[var(--text)]">{job.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${job.status === 'active' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                      {job.status}
                    </span>
                  </div>
                  <div className="text-xs font-mono text-[var(--text-3)] mb-1">{job.schedule}</div>
                  <div className="text-xs text-[var(--text-4)] truncate">{job.prompt?.slice(0, 100)}...</div>
                  <div className="flex gap-3 mt-2 text-[10px] text-[var(--text-4)]">
                    {job.lastRun && <span>Last: {job.lastRun}</span>}
                    {job.nextRun && <span>Next: {job.nextRun}</span>}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => toggleJob(job)} className="p-1.5 rounded hover:bg-[var(--surface-2)] text-[var(--text-3)]">
                    {job.status === 'active' ? <Play className="w-3 h-3 opacity-50" /> : <Play className="w-3 h-3 text-green-400" />}
                  </button>
                  <button onClick={() => deleteJob(job.id)} className="p-1.5 rounded hover:bg-[var(--down)]/10 text-[var(--down)]">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
