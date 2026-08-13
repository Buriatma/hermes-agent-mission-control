"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import "./jarvis.css";

export default function JarvisPage() {
  const [answer, setAnswer] = useState("");
  const [status, setStatus] = useState<any>(null);
  const [running, setRunning] = useState(false);
  const [tag, setTag] = useState({ cls: "", text: "IDLE" });
  const [reactorState, setReactorState] = useState({ cls: "", word: "STANDBY", sub: "awaiting uplink" });
  const [log, setLog] = useState<Array<{ time: string; kind: string; label: string; msg: string }>>([]);
  const [toolsList, setToolsList] = useState<string[]>([]);
  const [listening, setListening] = useState(false);
  const [convo, setConvo] = useState(false);
  const [muted, setMuted] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const responseRef = useRef<HTMLDivElement>(null);
  const activeController = useRef<AbortController | null>(null);
  const recognitionRef = useRef<any>(null);
  const runningRef = useRef(false);

  const now = () => new Date().toLocaleTimeString("en-GB", { hour12: false });

  const addLog = useCallback((kind: string, label: string, msg: string) => {
    setLog(prev => [{ time: now(), kind, label, msg }, ...prev].slice(0, 40));
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const r = await fetch("/api/jarvis/status").then(x => x.json());
      setStatus(r);
      if (r?.tools) setToolsList(r.tools);
      addLog("status", "STATUS", `core online · model=${r.model} profile=${r.profile} permission=${r.permission}`);
    } catch { addLog("error", "ERROR", "status fetch failed"); }
  }, [addLog]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const transmit = useCallback(async (message: string, options: { speak?: boolean } = {}) => {
    if (!message.trim() || runningRef.current) {
      addLog("note", "BUSY", "still working — wait");
      return;
    }
    runningRef.current = true;
    setRunning(true);
    setAnswer("");
    setReactorState({ cls: "running", word: "RUNNING", sub: "…" });
    setTag({ cls: "run", text: "RUNNING" });
    addLog("run", "RUN", `started; uplink cleared`);

    const fresh = /^\/new\b/.test(message.trim());
    let fullAnswer = "";
    const t0 = performance.now();
    const tick = setInterval(() => {
      if (!runningRef.current) return clearInterval(tick);
      const s = ((performance.now() - t0) / 1000).toFixed(1);
      if (!fullAnswer) setReactorState(prev => ({ ...prev, sub: `thinking… ${s}s` }));
    }, 200);

    try {
      activeController.current = new AbortController();
      const res = await fetch("/api/jarvis/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, fresh }),
        signal: activeController.current.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.requestId) {
        addLog("status", "STATUS", `queued: ${data.title || message.slice(0, 40)}`);
        let attempts = 0;
        const poll = setInterval(async () => {
          attempts++;
          try {
            const sj = await fetch("/api/jarvis/jobs").then(x => x.json());
            const job = sj?.done?.find((j: any) => j.id === data.requestId) || sj?.running?.find((j: any) => j.id === data.requestId);
            if (job?.result || attempts > 24) {
              clearInterval(poll);
              runningRef.current = false;
              setRunning(false);
              setReactorState({ cls: "done", word: "COMPLETE", sub: "" });
              setTag({ cls: "done", text: "COMPLETE" });
              if (job?.result) {
                fullAnswer = job.result;
                setAnswer(job.result);
                addLog("complete", "COMPLETE", "run completed");
              } else {
                addLog("error", "ERROR", "timeout waiting for response");
                setTag({ cls: "err", text: "ERROR" });
                setReactorState({ cls: "error", word: "FAULT", sub: "timeout" });
              }
              clearInterval(tick);
            }
          } catch { }
        }, 2000);
      } else {
        fullAnswer = data.error || "Done.";
        setAnswer(fullAnswer);
        runningRef.current = false;
        setRunning(false);
        setReactorState({ cls: "done", word: "COMPLETE", sub: "" });
        setTag({ cls: "done", text: "COMPLETE" });
        clearInterval(tick);
      }
    } catch (e: any) {
      if (e?.name === "AbortError") {
        addLog("note", "CANCEL", "run cancelled");
        setReactorState({ cls: "", word: "STANDBY", sub: "cancelled" });
        setTag({ cls: "", text: "IDLE" });
      } else {
        addLog("error", "ERROR", String(e).slice(0, 200));
        setReactorState({ cls: "error", word: "FAULT", sub: "stream dropped" });
        setTag({ cls: "err", text: "ERROR" });
      }
      runningRef.current = false;
      setRunning(false);
      clearInterval(tick);
    }
    activeController.current = null;
  }, [addLog]);

  const sendFromInput = useCallback(() => {
    const raw = inputRef.current?.value?.trim() || "";
    if (!raw) return;
    if (inputRef.current) inputRef.current.value = "";
    addLog("send", "SEND", `transmit: ${raw}`);
    transmit(raw);
  }, [transmit, addLog]);

  const cancelRun = useCallback(() => {
    if (runningRef.current && activeController.current) {
      fetch("/api/jarvis/cancel", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).catch(() => {});
      activeController.current.abort();
      runningRef.current = false;
      setRunning(false);
    }
    if (convo) {
      if (recognitionRef.current) { try { recognitionRef.current.onend = null; recognitionRef.current.stop(); } catch {} recognitionRef.current = null; }
      setConvo(false);
      setListening(false);
    }
  }, [convo]);

  // Voice toggle
  const micToggle = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (convo) {
      if (recognitionRef.current) { try { recognitionRef.current.onend = null; recognitionRef.current.stop(); } catch {} recognitionRef.current = null; }
      setConvo(false);
      setListening(false);
      addLog("voice", "VOICE", "conversation closed");
      setReactorState({ cls: "", word: "STANDBY", sub: "awaiting uplink" });
      return;
    }
    if (!SR) { addLog("error", "VOICE", "no speech recognition available — use Chrome"); return; }
    setConvo(true);
    setListening(true);
    addLog("voice", "VOICE", "browser speech recognition open · listening");
    setReactorState({ cls: "listening", word: "LISTENING", sub: "browser speech online" });

    const rec = new SR();
    recognitionRef.current = rec;
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = "";
    rec.onresult = (e: any) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const txt = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += txt;
        else interim += txt;
      }
      const shown = (finalText || interim || "").trim();
      if (shown) setReactorState(prev => ({ ...prev, sub: "HEARD: " + shown.slice(0, 42) }));
    };
    rec.onerror = () => {};
    rec.onend = async () => {
      const text = finalText.trim();
      if (!text) { if (convo) setTimeout(() => rec.start(), 250); return; }
      finalText = "";
      addLog("voice", "VOICE", `transcribed: "${text}"`);
      addLog("send", "SEND", `auto-sent voice: ${text}`);
      await transmit(text);
      if (convo) setTimeout(() => { try { rec.start(); } catch {} }, 350);
    };
    try { rec.start(); } catch { addLog("error", "VOICE", "failed to start"); }
  }, [convo, transmit, addLog]);

  const renderAnswer = answer || "";
  const toolChips = toolsList.length ? toolsList : ["loading tool matrix…"];

  return (
    <>
      <div className="scan" />
      <div className="grid-bg" />
      <div className="ambient a1" /><div className="ambient a2" />

      <header className="j-topbar">
        <div className="sigil"><span /></div>
        <div className="brandlock">
          <div className="overline">Hermes Agent Direct Channel</div>
          <div className="mega">JARVIS</div>
        </div>
        <div className="pills">
          <div className="pill ok"><i /><span>{status?.runtime === "hermes" ? "Gateway: online" : "Gateway: probing"}</span></div>
          <div className="pill"><i /><span>Profile: {status?.profile || "default"}</span></div>
          <div className="pill warn"><i /><span>Voice: browser</span></div>
        </div>
      </header>

      <div className="j-hud">
        {/* Left column */}
        <section className="j-col j-left j-glass">
          <header className="j-colhead">
            <div className="j-h">Command<br/>Matrix</div>
            <div className="j-sub">Click to execute</div>
          </header>
          <div className="j-cmds">
            {[
              { cmd: "/new", label: "/new", desc: "Fresh thread" },
              { cmd: "/goal", label: "/goal", desc: "Standing objective" },
              { cmd: "/tools", label: "/tools", desc: "Hermes tool status" },
              { cmd: "/browser", label: "/browser", desc: "Chrome / browser op" },
              { cmd: "/background", label: "/background", desc: "Async mission" },
              { cmd: "/mission", label: "/mission", desc: "Mission queue" },
              { cmd: "/personality", label: "/personality", desc: "Voice/tone overlay" },
              { cmd: "/commands", label: "/commands", desc: "Show commands" },
            ].map(c => (
              <button key={c.cmd} className="j-cmd" onClick={() => transmit(c.cmd, { speak: c.cmd !== "/tools" && c.cmd !== "/commands" })}>
                <b>{c.label}</b><span>{c.desc}</span>
              </button>
            ))}
          </div>
          <div className="j-toolrack">
            <div className="j-lbl">Connected Hermes Tools</div>
            <div className="j-chips">{toolChips.map((t, i) => <span key={i} className="j-chip">{t}</span>)}</div>
          </div>
          <div className="j-uplink">
            <div className="j-lbl">Pending uplink</div>
            <div className="j-field">
              <textarea ref={inputRef} rows={4} spellCheck={false} placeholder="Speak through browser voice or type a Hermes instruction." onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendFromInput(); } }} />
            </div>
          </div>
        </section>

        {/* Center column */}
        <section className="j-col j-center">
          <div className="j-reactor">
            <svg viewBox="0 0 520 520" id="core">
              <defs>
                <radialGradient id="orb" cx="50%" cy="45%" r="55%">
                  <stop offset="0%" stopColor="#ffffff" /><stop offset="25%" stopColor="#7ff7ff" />
                  <stop offset="58%" stopColor="#16bfd8" /><stop offset="100%" stopColor="#02111b" />
                </radialGradient>
                <filter id="soft" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="6" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
              </defs>
              <circle className="ring rr1" cx="260" cy="260" r="242" />
              <circle className="ring rr2" cx="260" cy="260" r="210" />
              <circle className="ring rr3" cx="260" cy="260" r="174" />
              <circle className="ring rr4" cx="260" cy="260" r="132" />
              <circle className="arcA" cx="260" cy="260" r="226" filter="url(#soft)" />
              <circle className="arcB" cx="260" cy="260" r="188" filter="url(#soft)" />
              <circle className="arcC" cx="260" cy="260" r="151" filter="url(#soft)" />
              <circle className="orb" cx="260" cy="260" r="64" fill="url(#orb)" filter="url(#soft)" />
              <circle className="orbrim" cx="260" cy="260" r="64" />
            </svg>
            <div className="j-status-overlay">
              <div className="j-stbrand">JARVIS CORE</div>
              <div className="j-stword">{reactorState.word}</div>
              <div className="j-strun">{reactorState.sub}</div>
            </div>
          </div>
          <div className="j-response j-glass">
            <div className="j-rhead"><span>JARVIS Response</span><span className={`j-rtag ${tag.cls}`}>{tag.text}</span></div>
            <div className="j-rbody" ref={responseRef}>
              {renderAnswer || <span className="j-placeholder">Standing by. Transmit an instruction.</span>}
              {running && !renderAnswer && <span className="j-cur" />}
            </div>
          </div>
          <div className="j-missionbar j-glass">
            <button className={`j-ctl j-mic ${convo ? "on" : ""}`} onClick={micToggle}>◉ Browser Voice</button>
            <button className="j-ctl j-run" onClick={sendFromInput}>Transmit to JARVIS ▸</button>
            <button className="j-ctl j-aux" onClick={() => transmit("/commands", { speak: false })}>Show Commands</button>
            <button className="j-ctl j-aux" onClick={() => transmit("/mission")}>Mission Control</button>
            <button className="j-ctl j-aux" onClick={() => setAnswer("")}>Clear</button>
            {running && <button className="j-ctl j-mute" onClick={cancelRun}>■ Cancel</button>}
          </div>
        </section>

        {/* Right column */}
        <section className="j-col j-right j-glass">
          <header className="j-colhead j-row">
            <div className="j-h j-sm">Action Log</div>
            <div className="j-live">LIVE TELEMETRY</div>
          </header>
          <div className="j-sysgrid">
            <div className="j-sysrow"><span>Gateway</span><b className={status?.runtime === "hermes" ? "ok" : ""}>{status?.runtime === "hermes" ? "online" : "offline"}</b></div>
            <div className="j-sysrow"><span>Brain</span><b>{status?.model || "—"}</b></div>
            <div className="j-sysrow"><span>Voice</span><b>{convo ? "live" : "standby"}</b></div>
            <div className="j-sysrow"><span>Profile</span><b>{status?.profile || "default"}</b></div>
            <div className="j-sysrow"><span>Runtime</span><b>{status?.runtime || "—"}</b></div>
            <div className="j-sysrow"><span>Uplink</span><b>{now()}</b></div>
          </div>
          <div className="j-missionPanel">
            <div className="j-log-lbl">Mission controls</div>
            <div className="j-miniBtns">
              <button onClick={() => transmit("/status", { speak: false })}>Status</button>
              <button onClick={() => transmit("/tools", { speak: false })}>Tools</button>
              <button onClick={() => transmit("/toolsets", { speak: false })}>Toolsets</button>
              <button onClick={() => transmit("/connectors", { speak: false })}>Connectors</button>
            </div>
          </div>
          <div className="j-log-lbl">Event stream</div>
          <div className="j-log">
            {log.map((e, i) => (
              <div key={i} className={`j-entry k-${e.kind}`}>
                <div className="j-top"><span className="j-ts">{e.time}</span><span className="j-kind">{e.label}</span></div>
                {e.msg && <div className="j-msg">{e.msg}</div>}
              </div>
            ))}
          </div>
        </section>
      </div>
      <div className="j-brandmark">HERMES · JARVIS OS</div>
    </>
  );
}
