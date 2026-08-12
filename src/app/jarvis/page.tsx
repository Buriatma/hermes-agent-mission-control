"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { Panel, Pill } from "@/components/ui/kit";
import { Send, Mic, MicOff, Command, Shield, Activity, Wrench, User, Target, RefreshCw, ChevronRight } from "lucide-react";

interface JarvisState {
  profile: string[];
  goal: string;
  personality: string;
  tasks: { text: string; done: boolean; at: number }[];
  missions: { id: string; mission: string; status: string; at: number; result?: string }[];
}

interface Job {
  id: string;
  title: string;
  status: string;
  result?: string;
  createdAt: string;
}

const QUICK_COMMANDS = [
  { label: "/new", cmd: "/new", arg: "" },
  { label: "/goal status", cmd: "/goal", arg: "status" },
  { label: "/tools", cmd: "/tools", arg: "" },
  { label: "/status", cmd: "/status", arg: "" },
  { label: "/profile", cmd: "/profile", arg: "" },
  { label: "/background", cmd: "/background", arg: "" },
];

export default function JarvisPage() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; text: string; time: string }>>([]);
  const [status, setStatus] = useState<any>(null);
  const [state, setState] = useState<JarvisState | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [listening, setListening] = useState(false);
  const [listeningSupported, setListeningSupported] = useState(false);
  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<number | null>(null);

  const fetchStatus = useCallback(async () => {
    const r = await fetch("/api/jarvis/status").then(x => x.json()).catch(() => null);
    setStatus(r);
    if (r?.state) setState(r.state);
    if (r?.jobs) setJobs(r.jobs);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (text: string) => {
    if (!text.trim() || sending) return;
    setSending(true);
    const userMsg = { role: "user" as const, text, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) };
    setMessages(prev => [...prev, userMsg]);
    setInput("");

    try {
      const res = await fetch("/api/jarvis/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();

      if (data.requestId) {
        let attempts = 0;
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = window.setInterval(async () => {
          attempts++;
          const statusRes = await fetch("/api/jarvis/status").then(x => x.json()).catch(() => null);
          if (statusRes?.jobs) {
            const job = statusRes.jobs.find((j: any) => j.id === data.requestId);
            if (job?.result || attempts > 24) {
              if (pollRef.current) clearInterval(pollRef.current);
              setSending(false);
              if (job?.result) {
                setMessages(prev => [...prev, { role: "assistant", text: job.result, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }]);
              }
            }
          }
        }, 1500);
      } else {
        setMessages(prev => [...prev, { role: "assistant", text: data.error || "Done.", time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }]);
        setSending(false);
      }
    } catch (e: any) {
      setMessages(prev => [...prev, { role: "assistant", text: `Error: ${e.message}`, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }]);
      setSending(false);
    }
  };

  // Speech recognition
  useEffect(() => {
    if (typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = "en-IN";

      recognitionRef.current.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        setInput(text);
        setListening(false);
      };
      recognitionRef.current.onerror = () => setListening(false);
      recognitionRef.current.onend = () => setListening(false);
      setListeningSupported(true);
    }
  }, []);

  const toggleListening = () => {
    if (!recognitionRef.current) return;
    if (listening) {
      recognitionRef.current.stop();
      setListening(false);
    } else {
      recognitionRef.current.start();
      setListening(true);
    }
  };

  const runCommand = async (cmd: string, arg?: string) => {
    const full = arg ? `${cmd} ${arg}` : cmd;
    await send(full);
  };

  const activeMissions = (state?.tasks || []).filter(t => !t.done).slice(-5);
  const recentMissions = (jobs || []).slice(0, 10);

  return (
    <div className="h-dvh flex flex-col relative bg-[var(--bg)]">
      {/* Jarvis HUD overlay - subtle */}
      <div
        className="absolute inset-0 pointer-events-none z-0 opacity-20"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0, 240, 255, 0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 240, 255, 0.06) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative z-10 flex-1 flex flex-col min-h-0">
        {/* Header */}
        <div className="shrink-0 px-4 py-3 border-b border-[var(--line)]/40 flex items-center justify-between bg-black/40 backdrop-blur-md">
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-[var(--accent)] tracking-wider truncate" style={{ textShadow: "0 0 10px rgba(0,240,255,0.5)" }}>
              J.A.R.V.I.S.
            </h1>
            <p className="text-[10px] text-[var(--text-4)] font-mono truncate">
              {status?.runtime === "hermes" ? "● ONLINE" : "○ OFFLINE"} · {state?.goal || "Ready"}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Pill tone={status?.runtime === "hermes" ? "up" : "warn"} className="hidden sm:inline-flex">
              {status?.model || "best-long-context"}
            </Pill>
            <button
              onClick={fetchStatus}
              className="p-2 rounded border border-[var(--line)]/40 bg-black/30 text-[var(--text-3)] active:border-[var(--accent)]/40"
              aria-label="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {messages.length === 0 && !loading && (
            <div className="text-center py-8">
              <p className="text-xs text-[var(--text-4)] font-mono">J.A.R.V.I.S. online. Awaiting command.</p>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[92%] sm:max-w-[75%] rounded-lg px-3 py-2.5 text-sm ${
                  m.role === "user"
                    ? "bg-[var(--accent)]/15 border border-[var(--accent)]/30 text-[var(--text)]"
                    : "bg-black/40 border border-[var(--line)]/40 text-[var(--text-2)]"
                }`}
              >
                <p className="whitespace-pre-wrap text-[13px] leading-relaxed">{m.text}</p>
                <span className="text-[10px] text-[var(--text-4)] mt-1 block text-right font-mono">{m.time}</span>
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="bg-black/40 border border-[var(--line)]/40 rounded-lg px-4 py-3">
                <div className="flex items-center gap-2 text-[var(--accent)]">
                  <div className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
                  <span className="text-xs font-mono">Processing…</span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Active Missions */}
        {activeMissions.length > 0 && (
          <div className="shrink-0 px-4 py-2 border-t border-[var(--line)]/30 bg-black/20">
            <div className="flex items-center gap-2 text-[10px] text-[var(--text-4)] font-mono uppercase tracking-wider mb-1.5">
              <Shield className="w-3 h-3" />
              Active Missions
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
              {activeMissions.map((t, i) => (
                <Pill key={i} tone="accent" className="shrink-0">
                  ◉ {t.text.slice(0, 28)}
                </Pill>
              ))}
            </div>
          </div>
        )}

        {/* Quick Commands - mobile optimized horizontal scroll */}
        <div className="shrink-0 px-4 py-2 border-t border-[var(--line)]/30 bg-black/20 overflow-x-auto">
          <div className="flex gap-2 min-w-max">
            {QUICK_COMMANDS.map((c, i) => (
              <button
                key={i}
                onClick={() => runCommand(c.cmd, c.arg)}
                className="flex items-center gap-1.5 px-3 py-2 rounded border border-[var(--line)]/40 bg-black/30 text-[var(--text-3)] active:border-[var(--accent)]/40 active:text-[var(--accent)] transition-all whitespace-nowrap"
                style={{ minHeight: 40 }}
              >
                <Command className="w-3.5 h-3.5" />
                <span className="text-[11px] font-mono">{c.label}</span>
              </button>
            ))}
            {listeningSupported && (
              <button
                onClick={toggleListening}
                className={`flex items-center gap-1.5 px-3 py-2 rounded border transition-all whitespace-nowrap ${
                  listening
                    ? "border-red-500 bg-red-500/20 text-red-400"
                    : "border-[var(--line)]/40 bg-black/30 text-[var(--text-3)] active:border-[var(--accent)]/40"
                }`}
                style={{ minHeight: 40 }}
                aria-label="Voice input"
              >
                {listening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                <span className="text-[11px] font-mono">{listening ? "Listening…" : "Voice"}</span>
              </button>
            )}
          </div>
        </div>

        {/* Input - fixed bottom, safe area aware */}
        <div className="shrink-0 p-3 border-t border-[var(--line)]/40 bg-black/60 backdrop-blur-md" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom))" }}>
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send(input)}
              placeholder="Command or message…"
              className="flex-1 bg-black/60 border border-[var(--line)]/50 rounded px-4 py-3 text-sm text-[var(--text)] placeholder:text-[var(--text-4)] font-mono focus:outline-none focus:border-[var(--accent)]/60 transition-colors"
              style={{ minHeight: 44 }}
            />
            <button
              onClick={() => send(input)}
              disabled={sending || !input.trim()}
              className="px-4 py-3 bg-[var(--accent)]/15 border border-[var(--accent)]/50 text-[var(--accent)] rounded active:bg-[var(--accent)]/25 transition-all disabled:opacity-40"
              style={{ minHeight: 44, minWidth: 44 }}
              aria-label="Send"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
