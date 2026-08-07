"use client";

import { useState, useEffect } from "react";
import { Panel, Button, Eyebrow } from "@/components/ui/kit";
import { Save, RefreshCw } from "lucide-react";

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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/hermes/settings")
      .then((r) => r.json())
      .then((d) => setSettings(d))
      .finally(() => setLoading(false));
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

  if (loading) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Eyebrow>GlyteOS Configuration</Eyebrow>
          <h1 className="text-[24px] font-semibold text-[var(--text)]">Jarvis & System Settings</h1>
        </div>
        <Button variant="primary" onClick={save} disabled={saving}>
          {saving ? "Saving..." : <><Save className="w-4 h-4" /> Save Settings</>}
        </Button>
      </div>

      <Panel className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="eyebrow mb-2 block">STT Server URL</label>
            <input className="w-full bg-[var(--surface-2)] p-2 rounded" value={settings.sttUrl} onChange={(e) => setSettings({...settings, sttUrl: e.target.value})} />
          </div>
          <div>
            <label className="eyebrow mb-2 block">STT API Token</label>
            <input type="password" className="w-full bg-[var(--surface-2)] p-2 rounded" value={settings.sttToken} onChange={(e) => setSettings({...settings, sttToken: e.target.value})} />
          </div>
          <div>
            <label className="eyebrow mb-2 block">TTS Server URL</label>
            <input className="w-full bg-[var(--surface-2)] p-2 rounded" value={settings.ttsUrl} onChange={(e) => setSettings({...settings, ttsUrl: e.target.value})} />
          </div>
          <div>
            <label className="eyebrow mb-2 block">TTS API Token</label>
            <input type="password" className="w-full bg-[var(--surface-2)] p-2 rounded" value={settings.ttsToken} onChange={(e) => setSettings({...settings, ttsToken: e.target.value})} />
          </div>
          <div>
            <label className="eyebrow mb-2 block">Water Interval (min)</label>
            <input type="number" className="w-full bg-[var(--surface-2)] p-2 rounded" value={settings.waterReminderInterval} onChange={(e) => setSettings({...settings, waterReminderInterval: Number(e.target.value)})} />
          </div>
          <div>
            <label className="eyebrow mb-2 block">Break Interval (min)</label>
            <input type="number" className="w-full bg-[var(--surface-2)] p-2 rounded" value={settings.breakReminderInterval} onChange={(e) => setSettings({...settings, breakReminderInterval: Number(e.target.value)})} />
          </div>
        </div>
      </Panel>
    </div>
  );
}
