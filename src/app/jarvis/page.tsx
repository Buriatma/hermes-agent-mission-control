"use client";
import { useState, useEffect, useRef } from "react";
import { Panel, SectionHeader, Button, Pill } from "@/components/ui/kit";
import { Send, Mic, Square, Command, Shield, Activity, Wrench, Globe, User, Target, Brain } from "lucide-react";

interface JarvisState {
  profile: string[];
  goal: string;
  personality: string;
  tasks: { text: string; done: boolean; at: number }[];
  missions: { id: string; mission: string; status: string; at: number; result?: string }[];
}

export default function JarvisPage() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant" | "system"; text: string; time: string }>>([]);
  const [status, setStatus] = useState<any>(null);
  const [state, setState] = useState<JarvisState | null>(null);
  const safeState = state ?? { profile: [], goal: "", personality: "", tasks: [], missions: [] };
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [listening, setListening] = useState(false);
  const [listeningSupported, setListeningSupported] = useState(false);
  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchStatus();
    fetchState();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchStatus = async () => {
    const r = await fetch("/api/jarvis/status").then(x => x.json()).catch(() => null);
    setStatus(r);
    setLoading(false);
  };

  const fetchState = async () => {
    const r = await fetch("/api/jarvis/state").then(x => x.json()).catch(() => null);
    setState(r);
  };

  const send = async (text: string) => {
    if (!text.trim() || sending) return;
    setSending(true);
    const userMsg = { role: "user" as const, text, time: new Date().toLocaleTimeString() };
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
        // Poll for response from AgentRequest queue / existing dispatch
        let attempts = 0;
        const poll = setInterval(async () => {
          attempts++;
          const statusRes = await fetch("/api/jarvis/status").then(x => x.json()).catch(() => null);
          if (statusRes?.jobs) {
            const job = statusRes.jobs.find((j: any) => j.id === data.requestId);
            if (job?.result || attempts > 20) {
              clearInterval(poll);
              setSending(false);
              if (job?.result) {
                setMessages(prev => [...prev, { role: "assistant", text: job.result, time: new Date().toLocaleTimeString() }]);
                fetchState();
              }
            }
          }
        }, 1500);
      } else {
        setMessages(prev => [...prev, { role: "assistant", text: data.error || "Done.", time: new Date().toLocaleTimeString() }]);
        setSending(false);
      }
    } catch (e: any) {
      setMessages(prev => [...prev, { role: "assistant", text: `Error: ${e.message}`, time: new Date().toLocaleTimeString() }]);
      setSending(false);
    }
  };

  // Speech recognition setup
  useEffect(() => {
    if (typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;

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

  const quickActions = [
    { label: "/new", icon: Command, action: () => runCommand("/new") },
    { label: "/goal", icon: Target, action: () => runCommand("/goal", "Status check") },
    { label: "/tools", icon: Wrench, action: () => runCommand("/tools") },
    { label: "/status", icon: Activity, action: () => runCommand("/status") },
    { label: "/profile", icon: User, action: () => runCommand("/profile") },
    { label: "/voice", icon: Mic, action: toggleListening, active: listening },
  ];

  return (
    <div className="h-full flex flex-col relative">
      {/* Jarvis HUD overlay */}
      <div className="absolute inset-0 pointer-events-none z-0 opacity-30"
        style={{
          backgroundImage: "linear-gradient(rgba(0, 240, 255, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 240, 255, 0.05) 1px, transparent 1px)",
          backgroundSize: "50px 50px",
        }}
      />

      <div className="relative z-10 flex-1 flex flex-col min-h-0">
        {/* Header */}
        <div className="px-4 md:px-6 py-3 border-b border-[var(--line)]/40 flex items-center justify-between bg-black/30 backdrop-blur-md">
          <div>
            <h1 className="text-lg font-semibold text-[var(--accent)] tracking-wider" style={{ textShadow: "0 0 10px rgba(0,240,255,0.5)" }}>
              J.A.R.V.I.S.
            </h1>
            <p className="text-[11px] text-[var(--text-4)] font-mono">
              {status?.runtime === "hermes" ? "● ONLINE" : "○ OFFLINE"} · {safeState.goal || "Ready"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Pill tone={status?.runtime === "hermes" ? "up" : "warn"}>
              {status?.model || "best-long-context"}
            </Pill>
            <Button variant="ghost" size="sm" onClick={fetchStatus}>
              <Activity className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 md:px-6 py-4 space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] md:max-w-[70%] rounded-lg px-4 py-2.5 text-sm ${
                m.role === "user"
                  ? "bg-[var(--accent)]/15 border border-[var(--accent)]/30 text-[var(--text)]"
                  : "bg-black/40 border border-[var(--line)]/40 text-[var(--text-2)]"
              }`}>
                <p className="whitespace-pre-wrap">{m.text}</p>
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

        {/* Mission queue */}
        {(state?.tasks?.length ?? 0) > 0 && (
          <div className="px-4 md:px-6 py-2 border-t border-[var(--line)]/30 bg-black/20">
            <div className="flex items-center gap-2 text-[10px] text-[var(--text-4)] font-mono uppercase tracking-wider mb-1">
              <Shield className="w-3 h-3" />
              Active Missions
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {safeState.tasks.slice(-5).map((t, i) => (
                <Pill key={i} tone={t.done ? "neutral" : "accent"}>
                  {t.done ? "✓" : "◉"} {t.text.slice(0, 30)}
                </Pill>
              ))}
            </div>
          </div>
        )}

        {/* Quick actions */}
        <div className="px-4 md:px-6 py-2 border-t border-[var(--line)]/30 bg-black/20 overflow-x-auto">
          <div className="flex gap-2 min-w-max">
            {quickActions.map((a, i) => (
              <button
                key={i}
                onClick={a.action}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded border text-[11px] font-mono transition-all ${
                  a.active
                    ? "border-[var(--accent)] bg-[var(--accent)]/20 text-[var(--accent)] shadow-[0_0_10px_rgba(0,240,255,0.3)]"
                    : "border-[var(--line)]/40 bg-black/30 text-[var(--text-3)] hover:border-[var(--accent)]/40"
                }`}
              >
                <a.icon className="w-3.5 h-3.5" />
                {a.label}
              </button>
            ))}
          </div>
        </div>

        {/* Input */}
        <div className="p-3 md:p-4 border-t border-[var(--line)]/40 bg-black/40 backdrop-blur-md">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send(input)}
              placeholder="Command or message… (/ for commands)"
              className="flex-1 bg-black/50 border border-[var(--line)]/50 rounded px-4 py-2.5 text-sm text-[var(--text)] placeholder:text-[var(--text-4)] font-mono focus:outline-none focus:border-[var(--accent)]/50 transition-colors"
            />
            <button
              onClick={() => send(input)}
              disabled={sending || !input.trim()}
              className="px-4 py-2.5 bg-[var(--accent)]/15 border border-[var(--accent)]/50 text-[var(--accent)] rounded hover:bg-[var(--accent)]/25 transition-all disabled:opacity-40"
              style={{ textShadow: "0 0 8px rgba(0,240,255,0.4)" }}
            >
              <Send className="w-4 h-4" />
            </button>
            {listeningSupported && (
              <button
                onClick={toggleListening}
                className={`px-3 py-2.5 rounded border transition-all ${
                  listening
                    ? "border-red-500 bg-red-500/20 text-red-400 animate-pulse"
                    : "border-[var(--line)]/40 bg-black/30 text-[var(--text-3)]"
                }`}
              >
                <Mic className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
