"use client";
import { useState, useEffect } from "react";
import { Panel, Button, Eyebrow } from "@/components/ui/kit";
import { Save } from "lucide-react";

interface EnvVar {
  key: string;
  value: string;
  is_sensitive: boolean;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    sttUrl: "",
    sttToken: "",
    ttsUrl: "",
    ttsToken: "",
    waterReminderInterval: 60,
    breakReminderInterval: 120,
    wakeWord: "Jarvis"
  });
  const [yamlConfig, setYamlConfig] = useState<any>(null);
  const [envVars, setEnvVars] = useState<EnvVar[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/hermes/settings").then(r => r.json()),
      fetch("/api/hermes/config").then(r => r.ok ? r.json() : null),
      fetch("/api/hermes/env").then(r => r.ok ? r.json() : null)
    ]).then(([s, conf, env]) => {
      setSettings(s || {});
      if (conf) setYamlConfig(conf.config);
      if (env) setEnvVars(env.variables || []);
    }).finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    await fetch("/api/hermes/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setSaving(false);
  };

  if (loading) return <div className="p-6 text-[var(--text-3)]">Loading settings...</div>;

  return (
    <div className="space-y-6 p-4 md:p-6 overflow-y-auto h-full pb-24">
      <div className="flex items-center justify-between">
        <div>
          <Eyebrow>GlyteOS Configuration</Eyebrow>
          <h1 className="text-[24px] font-semibold text-[var(--text)]">System Settings</h1>
        </div>
        <Button variant="primary" onClick={save} disabled={saving}>
          {saving ? "Saving..." : <><Save className="w-4 h-4" /> Save Settings</>}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Panel className="p-6 space-y-6">
            <h2 className="text-sm font-semibold text-[var(--text-3)] uppercase tracking-wider mb-2">Voice & Reminders</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="eyebrow mb-2 block">STT Server URL</label>
                <input className="w-full bg-[var(--surface-2)] p-2 rounded text-sm" value={settings.sttUrl} onChange={(e) => setSettings({...settings, sttUrl: e.target.value})} />
              </div>
              <div>
                <label className="eyebrow mb-2 block">STT API Token</label>
                <input type="password" className="w-full bg-[var(--surface-2)] p-2 rounded text-sm" value={settings.sttToken} onChange={(e) => setSettings({...settings, sttToken: e.target.value})} />
              </div>
              <div>
                <label className="eyebrow mb-2 block">TTS Server URL</label>
                <input className="w-full bg-[var(--surface-2)] p-2 rounded text-sm" value={settings.ttsUrl} onChange={(e) => setSettings({...settings, ttsUrl: e.target.value})} />
              </div>
              <div>
                <label className="eyebrow mb-2 block">TTS API Token</label>
                <input type="password" className="w-full bg-[var(--surface-2)] p-2 rounded text-sm" value={settings.ttsToken} onChange={(e) => setSettings({...settings, ttsToken: e.target.value})} />
              </div>
              <div>
                <label className="eyebrow mb-2 block">Water Interval (min)</label>
                <input type="number" className="w-full bg-[var(--surface-2)] p-2 rounded text-sm" value={settings.waterReminderInterval} onChange={(e) => setSettings({...settings, waterReminderInterval: Number(e.target.value)})} />
              </div>
              <div>
                <label className="eyebrow mb-2 block">Break Interval (min)</label>
                <input type="number" className="w-full bg-[var(--surface-2)] p-2 rounded text-sm" value={settings.breakReminderInterval} onChange={(e) => setSettings({...settings, breakReminderInterval: Number(e.target.value)})} />
              </div>
            </div>
          </Panel>

          {/* Environment variables list */}
          {envVars.length > 0 && (
            <Panel className="p-6">
              <h2 className="text-sm font-semibold text-[var(--text-3)] uppercase tracking-wider mb-3">Environment Variables (.env)</h2>
              <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                {envVars.map(v => (
                  <div key={v.key} className="flex justify-between text-xs font-mono p-2 bg-[var(--bg)] rounded border border-[var(--line)]">
                    <span className="text-[var(--text-4)]">{v.key}</span>
                    <span className={v.is_sensitive ? "text-yellow-500" : "text-[var(--text)]"}>{v.value}</span>
                  </div>
                ))}
              </div>
            </Panel>
          )}
        </div>

        {/* Read-only config.yaml structure */}
        <div>
          <Panel className="p-6 h-full flex flex-col">
            <h2 className="text-sm font-semibold text-[var(--text-3)] uppercase tracking-wider mb-3">config.yaml (Active Profile)</h2>
            {yamlConfig ? (
              <div className="space-y-4 overflow-y-auto flex-1 max-h-[600px]">
                {Object.entries(yamlConfig).map(([section, values]: [string, any]) => (
                  <div key={section} className="border border-[var(--line)] rounded-lg p-3 bg-[var(--bg)]">
                    <h3 className="text-xs font-bold text-[var(--accent)] uppercase tracking-wider mb-2">{section}</h3>
                    <div className="space-y-1">
                      {Object.entries(values).map(([k, v]: [string, any]) => (
                        <div key={k} className="flex justify-between text-xs font-mono">
                          <span className="text-[var(--text-4)]">{k}:</span>
                          <span className="text-[var(--text-3)] truncate max-w-[200px]">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[var(--text-4)] italic">No configuration values loaded.</p>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
