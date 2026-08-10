"use client";
import { useState, useEffect } from 'react';
import { Panel, SectionHeader } from '@/components/ui/kit';

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/hermes/analytics')
      .then(r => r.json())
      .then(d => setData(d))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6 text-[var(--text-3)]">Loading analytics...</div>;

  return (
    <div className="h-full p-6 space-y-6 overflow-y-auto">
      <SectionHeader title="System Analytics" label="Token usage and model performance" />
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Panel className="p-6">
           <h3 className="font-semibold text-sm">Model Distribution</h3>
           <div className="space-y-2 mt-4">
            {data?.model_usage && Object.entries(data.model_usage).map(([m, c]) => (
                <div key={m} className="flex justify-between text-sm">
                    <span className="font-mono text-[var(--text-4)]">{m}</span>
                    <span className="font-semibold">{String(c)}</span>
                </div>
            ))}
           </div>
        </Panel>
        
        <Panel className="p-6">
           <h3 className="font-semibold text-sm">Token Usage (7d)</h3>
           <div className="text-2xl font-bold mt-4">{data?.total_tokens || 0}</div>
           <p className="text-xs text-[var(--text-4)] mt-1">Total tokens across all sessions</p>
        </Panel>
      </div>
    </div>
  );
}
