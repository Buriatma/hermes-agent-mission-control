"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Trash2, Plus, Cpu, Check, Layers, Settings, Bell, X, Copy, Paperclip, FileText, Image, Code, FileJson, FileType, Download, Mic, Volume2, VolumeX, ChevronDown, Menu } from "lucide-react";
import { Panel, Button, Eyebrow } from "@/components/ui/kit";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import VoiceMode from "@/components/voice-mode";

// ─── Types ───────────────────────────────────────────────
interface Attachment {
  id: string;
  name: string;
  type: string;
  size?: string;
  url?: string;
  preview?: string;
}

interface Message {
  id: string;
  sender: "user" | "hermes";
  text: string;
  timestamp: string;
  model?: string;
  status?: "pending" | "done" | "error";
  attachments?: Attachment[];
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: string;
}

// ─── Helpers ─────────────────────────────────────────────
const FILE_ICONS: Record<string, any> = {
  image: Image,
  pdf: FileText,
  json: FileJson,
  code: Code,
  png: FileType,
  default: Paperclip,
};

function formatBytes(bytes: number) {
  if (!bytes || isNaN(bytes)) return "";
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i ? 1 : 0)} ${sizes[i]}`;
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {});
}

// ─── Markdown Renderer ───────────────────────────────────
function MarkdownMessage({ text }: { text: string }) {
  return (
    <div className="prose prose-invert max-w-none text-[13.5px] leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight, rehypeRaw]}
        components={{
          pre: ({ children, ...props }) => (
            <div className="relative group my-2">
              <pre {...props} className="bg-[#0d1117] border border-[var(--line)] rounded-[8px] p-3 overflow-x-auto text-[12.5px]">
                {children}
              </pre>
              <button
                onClick={() => {
                  const text = typeof children === 'string' ? children : '';
                  copyToClipboard(text.replace(/<[^>]*>/g, ''));
                }}
                className="absolute top-2 right-2 p-1.5 rounded bg-white/10 hover:bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Copy code"
              >
                <Copy className="w-3.5 h-3.5 text-white" />
              </button>
            </div>
          ),
          code: ({ className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className || "");
            const codeString = String(children).replace(/\n$/, "");
            const isInline = !match;
            return isInline ? (
              <code {...props} className="bg-[var(--surface-2)] px-1.5 py-0.5 rounded text-[12px] border border-[var(--line)]">
                {codeString}
              </code>
            ) : (
              <code className={className} {...props}>
                {codeString}
              </code>
            );
          },
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline">
              {children}
            </a>
          ),
          img: ({ src, alt }) => (
            <img src={src} alt={alt || "Image"} className="max-w-full h-auto rounded-[8px] border border-[var(--line)] my-2" loading="lazy" />
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

// ─── Attachment Preview ──────────────────────────────────
function AttachmentPreview({ attachment }: { attachment: Attachment }) {
  const IconComponent = FILE_ICONS[attachment.type] || FILE_ICONS.default;
  const isImage = attachment.type === "image" || attachment.name.match(/\.(png|jpg|jpeg|gif|webp)$/i);
  const isPDF = attachment.type === "pdf" || attachment.name.endsWith(".pdf");

  return (
    <div className="inline-flex items-center gap-2.5 bg-[var(--surface-2)] border border-[var(--line)] rounded-[10px] p-2.5 max-w-[280px]">
      {isImage && attachment.preview ? (
        <img src={attachment.preview} alt={attachment.name} className="w-12 h-12 object-cover rounded-[6px]" />
      ) : (
        <div className="w-10 h-10 rounded-[6px] bg-[var(--surface-1)] flex items-center justify-center text-[var(--accent)]">
          <IconComponent className="w-5 h-5" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium text-[var(--text)] truncate">{attachment.name}</p>
        {attachment.size && <p className="text-[10.5px] text-[var(--text-3)] num">{attachment.size}</p>}
      </div>
    </div>
  );
}

// ─── Notification Panel ──────────────────────────────────
interface Notification {
  id: string;
  title: string;
  body: string;
  time: string;
  read: boolean;
}

function NotificationPanel({ notifications, onClose }: { notifications: Notification[]; onClose: () => void }) {
  return (
    <div className="absolute right-0 top-full mt-2 w-96 panel z-50 animate-[hq-rise_0.2s_ease]">
      <div className="p-4 border-b border-[var(--line)] flex items-center justify-between">
        <Eyebrow>Notifications</Eyebrow>
        <button onClick={onClose} className="p-1 hover:bg-[var(--surface-2)] rounded">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="max-h-80 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="p-6 text-center text-[var(--text-3)] text-[13px]">No notifications yet.</div>
        ) : (
          notifications.map((n) => (
            <div key={n.id} className={`p-3.5 border-b border-[var(--line)] last:border-0 ${!n.read ? "bg-[var(--surface-2)]/50" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[13px] font-medium text-[var(--text)]">{n.title}</p>
                  <p className="text-[11.5px] text-[var(--text-3)] mt-0.5">{n.body}</p>
                  <p className="text-[10.5px] text-[var(--text-4)] num mt-1.5">{n.time}</p>
                </div>
                {!n.read && <span className="w-2 h-2 rounded-full bg-[var(--accent)] shrink-0 mt-1" />}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Main Chat Page ──────────────────────────────────────
export default function ChatPage() {
  const [showSidebar, setShowSidebar] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([
    {
      id: "default",
      title: "GlyteTech Core System",
      updatedAt: new Date().toISOString(),
      messages: [
        {
          id: "1",
          sender: "hermes",
          text: "Hello Keshav! I am **GlyteOS Core**.\n\nI support:\n- **Text chat**\n- **Code blocks** with syntax highlighting\n- **Files**: PDF, JSON, PNG, images\n- **Markdown**, tables, LaTeX, Mermaid\n\nUse `/model` to switch models, `/clear` to reset.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ],
    },
  ]);
  const [activeSessionId, setActiveSessionId] = useState("default");
  const [input, setInput] = useState("");
  const [currentModel, setCurrentModel] = useState("best-long-context");
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showVoiceMode, setShowVoiceMode] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([
    { id: "1", title: "Bridge Connected", body: "Hermes bridge is running on main VPS.", time: "2m ago", read: false },
    { id: "2", title: "Deployment Complete", body: "GlyteOS v2.0 deployed to Vercel.", time: "1h ago", read: false },
  ]);
  const [healthStatus, setHealthStatus] = useState({ online: false });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Poll health status
  useEffect(() => {
    const pollHealth = async () => {
      try {
        const res = await fetch("/api/hermes/health");
        if (res.ok) setHealthStatus(await res.json());
      } catch {}
    };
    pollHealth();
    const interval = setInterval(pollHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0];

  // TTS speaker
  const speakText = (text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const cleanText = text.replace(/[*#`_\-]/g, ""); // Strip markdown
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  // Export functions
  const exportSessionMarkdown = () => {
    const md = activeSession.messages
      .map((m) => `### ${m.sender === "user" ? "User" : "Hermes"} (${m.timestamp})\n\n${m.text}\n`)
      .join("\n---\n\n");
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeSession.title.replace(/\s+/g, "_")}.md`;
    a.click();
  };

  const exportSessionJSON = () => {
    const json = JSON.stringify(activeSession, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeSession.title.replace(/\s+/g, "_")}.json`;
    a.click();
  };

  // Auto scroll
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeSession.messages, loading]);

  // Keyboard shortcut Cmd/Ctrl+Shift+O for notifications
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "o") {
        e.preventDefault();
        setShowNotifications((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const markNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!input.trim() && attachments.length === 0) || loading) return;

    const userText = input.trim();
    setInput("");
    setAttachments([]);

    // Commands
    if (userText.startsWith("/model")) {
      const parts = userText.split(" ");
      if (parts[1]) {
        const found = AVAILABLE_MODELS.find((m) => m.id.includes(parts[1]));
        if (found) {
          setCurrentModel(found.id);
          appendSystemMessage(`Model switched to ${found.name}`);
        } else {
          appendSystemMessage(`Unknown model. Available: ${AVAILABLE_MODELS.map((m) => m.id).join(", ")}`);
        }
      } else {
        setShowModelPicker(true);
      }
      return;
    }

    if (userText === "/clear") {
      clearChat();
      return;
    }

    const fileNames = attachments.map((a) => a.name).join(", ");
    const fullText = fileNames ? `${userText}\n\n**Attachments:** ${fileNames}` : userText;

    const newMsg: Message = {
      id: Date.now().toString(),
      sender: "user",
      text: fullText,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      attachments: [...attachments],
    };

    updateActiveSessionMessages([...activeSession.messages, newMsg]);
    setLoading(true);

    try {
      const res = await fetch("/api/hermes/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: fullText,
          sideEffecting: false,
          kind: "chat",
          title: userText.slice(0, 30) || "Attachment",
        }),
      });

      if (res.ok) {
        const json = await res.json();
        const reqId = json.request?.id;

        // Poll for real response from Hermes Bridge
        let replyText = "Request sent to Hermes Agent. Executing on server…";
        let completed = false;

        if (reqId) {
          const placeholderId = `thinking-${reqId}`;
          const replyMsg: Message = {
            id: placeholderId,
            sender: "hermes",
            text: "Request sent to Hermes Agent. Executing...",
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            model: currentModel,
          };
          updateActiveSessionMessages([...activeSession.messages, newMsg, replyMsg]);

          const pollStatus = async () => {
            try {
              const statusRes = await fetch(`/api/hermes/requests/${reqId}`);
              if (statusRes.ok) {
                const data = await statusRes.json();
                const status = data.status || "running";

                if (status === "done" || status === "completed") {
                  // Fetch the actual result from stream endpoint
                  const streamRes = await fetch(`/api/hermes/requests/${reqId}/stream`);
                  let resultText = "Task completed.";
                  if (streamRes.ok) {
                    resultText = await streamRes.text() || resultText;
                  }
                  const finalMsg: Message = { ...replyMsg, text: resultText, id: reqId };
                  updateActiveSessionMessages(
                    activeSession.messages.map(m => m.id === placeholderId ? finalMsg : m)
                  );
                } else if (status === "failed") {
                  const errMsg: Message = { ...replyMsg, text: "Execution failed. Please check bridge logs.", id: reqId };
                  updateActiveSessionMessages(
                    activeSession.messages.map(m => m.id === placeholderId ? errMsg : m)
                  );
                }
                // If still running, do nothing (just wait for next poll)
              }
            } catch (err) {
              console.error("Polling error:", err);
            }
          };
          pollStatus();
          const pollInterval = setInterval(pollStatus, 2000);
          // Cleanup on component unmount would go here in real app
        }
      } else {
        appendSystemMessage("Failed to dispatch to Hermes bus. Check connection.");
      }
    } catch {
      appendSystemMessage("Error connecting to GlyteOS Bridge.");
    } finally {
      setLoading(false);
    }
  };

  const appendSystemMessage = (text: string) => {
    const sysMsg: Message = {
      id: Date.now().toString(),
      sender: "hermes",
      text: `[System] ${text}`,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    updateActiveSessionMessages([...activeSession.messages, sysMsg]);
  };

  const updateActiveSessionMessages = (msgs: Message[]) => {
    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeSessionId
          ? { ...s, messages: msgs, updatedAt: new Date().toISOString() }
          : s
      )
    );
  };

  const createNewSession = () => {
    const id = Date.now().toString();
    const newSess: ChatSession = {
      id,
      title: `Session ${sessions.length + 1}`,
      updatedAt: new Date().toISOString(),
      messages: [
        {
          id: "1",
          sender: "hermes",
          text: "New session started. How can I help you?",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ],
    };
    setSessions([newSess, ...sessions]);
    setActiveSessionId(id);
  };

  const deleteSession = (id: string) => {
    if (sessions.length === 1) return;
    setSessions(sessions.filter((s) => s.id !== id));
    if (activeSessionId === id) setActiveSessionId(sessions[0].id);
  };

  const clearChat = () => {
    updateActiveSessionMessages([]);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newAttachments: Attachment[] = files.map((file) => {
      const isImage = file.type.startsWith("image/");
      return {
        id: `file-${Date.now()}-${Math.random()}`,
        name: file.name,
        type: isImage ? "image" : file.type.split("/")[0] || "file",
        size: formatBytes(file.size),
        url: isImage ? URL.createObjectURL(file) : undefined,
      };
    });
    setAttachments((prev) => [...prev, ...newAttachments]);
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-4rem)] md:h-[calc(100vh-2rem)] gap-4 overflow-hidden">
      {/* Sessions Sidebar - Drawer on mobile */}
      <div className={`${
        showSidebar ? "fixed inset-0 z-50 bg-[var(--bg)]/90 p-4" : "hidden"
      } lg:flex flex-col w-full lg:w-72 bg-[var(--surface-1)] rounded-[12px] border border-[var(--line)] p-3`}>
        <div className="flex items-center justify-between mb-3 px-2">
          <Eyebrow>Sessions</Eyebrow>
          <Button size="sm" variant="ghost" onClick={() => {createNewSession(); setShowSidebar(false);}}>
            <Plus className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="ghost" className="lg:hidden" onClick={() => setShowSidebar(false)}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-1">
          {sessions.map((s) => (
            <div key={s.id} className={`group flex items-center gap-2 px-3 py-2.5 rounded-[8px] text-[13px] cursor-pointer transition-colors ${
              s.id === activeSessionId ? "bg-[var(--surface-2)] text-[var(--text)] font-medium" : "text-[var(--text-3)] hover:text-[var(--text-2)] hover:bg-[var(--surface-2)]/50"
            }`}>
              <button onClick={() => setActiveSessionId(s.id)} className="flex-1 text-left truncate">
                {s.title}
              </button>
              {sessions.length > 1 && (
                <button onClick={() => deleteSession(s.id)} className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-opacity">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Model Selector */}
        <div className="pt-3 border-t border-[var(--line)] space-y-2">
          <button
            onClick={() => setShowModelPicker(!showModelPicker)}
            className="w-full text-left px-3 py-2 rounded-[8px] bg-[var(--surface-2)] border border-[var(--line)] flex items-center justify-between text-[11.5px]"
          >
            <div className="flex items-center gap-2 truncate">
              <Cpu className="w-4 h-4 text-[var(--accent)] shrink-0" />
              <span className="truncate text-[var(--text-2)]">{AVAILABLE_MODELS.find((m) => m.id === currentModel)?.name}</span>
            </div>
            <Layers className="w-3.5 h-3.5 text-[var(--text-3)] shrink-0" />
          </button>

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => {
                setShowNotifications((v) => !v);
                markNotificationsRead();
              }}
              className="w-full text-left px-3 py-2 rounded-[8px] bg-[var(--surface-2)] border border-[var(--line)] flex items-center justify-between text-[11.5px]"
            >
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-[var(--accent)] shrink-0" />
                <span className="text-[var(--text-2)]">Notifications</span>
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-[var(--accent)] text-white text-[9.5px] num">{unreadCount}</span>
                )}
              </div>
              <Settings className="w-3.5 h-3.5 text-[var(--text-3)] shrink-0" />
            </button>
            {showNotifications && (
              <NotificationPanel notifications={notifications} onClose={() => setShowNotifications(false)} />
            )}
          </div>
        </div>
      </div>

      {/* Main Chat Interface */}
      <div className="flex-1 flex flex-col bg-[var(--surface-1)] rounded-[12px] border border-[var(--line)] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--line)] flex items-center justify-between bg-[var(--bg)]/50">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" className="lg:hidden" onClick={() => setShowSidebar(true)}>
              <Menu className="w-5 h-5" />
            </Button>
            <div className="flex-1">
              <h2 className="text-[15px] font-semibold text-[var(--text)] flex items-center gap-2">
                {activeSession.title}
                <span className={`w-2 h-2 rounded-full ${healthStatus.online ? "bg-green-500" : "bg-red-500"}`} />
              </h2>
              <p className="text-[11px] text-[var(--text-3)]">
                {AVAILABLE_MODELS.find((m) => m.id === currentModel)?.name} · Markdown & files supported
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setShowVoiceMode(true)}>
            <Mic className={`w-4 h-4 ${showVoiceMode ? "text-[var(--accent)]" : ""}`} />
          </Button>
          <Button variant="ghost" size="sm" onClick={exportSessionMarkdown}>
            <Download className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={exportSessionJSON}>
            <FileJson className="w-4 h-4" />
          </Button>
          {isSpeaking ? (
            <Button variant="ghost" size="sm" onClick={stopSpeaking}>
              <VolumeX className="w-4 h-4 text-[var(--accent)]" />
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => speakText(activeSession.messages[activeSession.messages.length - 1]?.text || "")}>
              <Volume2 className="w-4 h-4" />
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
            <button onClick={() => setShowModelPicker(!showModelPicker)} className="p-2 text-[var(--text-2)] hover:bg-[var(--surface-2)] rounded-lg">
              <Cpu className="w-5 h-5" />
            </button>
            <Button size="sm" variant="ghost" onClick={clearChat}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Messages List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeSession.messages.map((msg) => (
            <div key={msg.id} className={`flex gap-4 max-w-3xl ${msg.sender === "user" ? "ml-auto flex-row-reverse" : ""}`}>
              <div className={`w-8 h-8 rounded-[8px] flex items-center justify-center shrink-0 ${
                msg.sender === "user" ? "bg-[var(--accent)] text-white" : "bg-[var(--surface-2)] text-[var(--text)]"
              }`}>
                {msg.sender === "user" ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              <div className={`flex flex-col ${msg.sender === "user" ? "items-end" : "items-start"} max-w-[85%]`}>
                {/* Attachments */}
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {msg.attachments.map((att) => (
                      <AttachmentPreview key={att.id} attachment={att} />
                    ))}
                  </div>
                )}

                {/* Message Content */}
                <div className={`p-4 rounded-[12px] text-[13.5px] leading-relaxed ${
                  msg.sender === "user"
                    ? "bg-[var(--accent)] text-white"
                    : "bg-[var(--surface-2)] text-[var(--text)] border border-[var(--line)]"
                }`}>
                  {msg.sender === "hermes" ? <MarkdownMessage text={msg.text} /> : <p className="whitespace-pre-wrap">{msg.text}</p>}
                </div>

                <div className="flex items-center gap-2 mt-1.5 px-1">
                  <span className="text-[10px] text-[var(--text-4)]">{msg.timestamp}</span>
                  {msg.model && (
                    <span className="text-[9.5px] num px-1.5 py-0.5 rounded bg-[var(--surface-2)] text-[var(--text-3)] border border-[var(--line)]">
                      {msg.model}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-3 text-[var(--text-3)] text-[13px]">
              <Bot className="w-4 h-4 animate-pulse" />
              <span>GlyteOS is thinking…</span>
            </div>
          )}

          <div ref={chatBottomRef} />
        </div>

        {/* Command Bar */}
        <div className="px-6 py-2 bg-[var(--bg)]/30 border-t border-[var(--line)] flex items-center gap-2 overflow-x-auto text-[11px]">
          <span className="text-[var(--text-4)] font-medium shrink-0">Commands:</span>
          <button onClick={() => setInput("/model ")} className="num px-2 py-0.5 rounded bg-[var(--surface-2)] text-[var(--text-2)] hover:border-[var(--line)] border border-transparent shrink-0">
            /model
          </button>
          <button onClick={() => setInput("/clear")} className="num px-2 py-0.5 rounded bg-[var(--surface-2)] text-[var(--text-2)] hover:border-[var(--line)] border border-transparent shrink-0">
            /clear
          </button>
          <button onClick={() => setInput("List repair tickets")} className="num px-2 py-0.5 rounded bg-[var(--surface-2)] text-[var(--text-2)] hover:border-[var(--line)] border border-transparent shrink-0">
            Repair Tickets
          </button>
          <button onClick={() => setInput("Check bridge status")} className="num px-2 py-0.5 rounded bg-[var(--surface-2)] text-[var(--text-2)] hover:border-[var(--line)] border border-transparent shrink-0">
            Bridge Status
          </button>
        </div>

        {/* Attachment Preview Bar */}
        {attachments.length > 0 && (
          <div className="px-6 py-2 bg-[var(--bg)]/30 border-t border-[var(--line)] flex items-center gap-2 overflow-x-auto">
            {attachments.map((att) => (
              <div key={att.id} className="inline-flex items-center gap-2 bg-[var(--surface-2)] border border-[var(--line)] rounded-full px-3 py-1.5">
                <Paperclip className="w-3.5 h-3.5 text-[var(--text-3)]" />
                <span className="text-[11px] text-[var(--text-2)] max-w-[120px] truncate">{att.name}</span>
                {att.size && <span className="text-[10px] text-[var(--text-3)] num">{att.size}</span>}
                <button onClick={() => removeAttachment(att.id)} className="text-[var(--text-3)] hover:text-[var(--text)]">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={handleSend} className="p-4 bg-[var(--bg)] border-t border-[var(--line)] flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.pdf,.json,.txt,.md,.csv,.png,.jpg,.jpeg,.gif,.webp"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button type="button" onClick={() => fileInputRef.current?.click()} className="p-3 rounded-[10px] bg-[var(--surface-2)] text-[var(--text-2)] hover:text-[var(--text)] transition-colors shrink-0">
            <Paperclip className="w-5 h-5" />
          </button>
          <input
            type="text"
            placeholder="Type a message or /command... Supports: Markdown, PDF, JSON, images"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 bg-[var(--surface-2)] text-[var(--text)] text-[14px] px-4 py-3 rounded-[10px] border border-[var(--line)] outline-none focus:border-[var(--accent)]"
          />
          <button
            type="submit"
            disabled={(!input.trim() && attachments.length === 0) || loading}
            className="btn-primary p-3 rounded-[10px] shrink-0 disabled:opacity-40"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Model Picker Modal */}
      {showModelPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowModelPicker(false)}>
          <div className="panel w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[16px] font-semibold text-[var(--text)]">Select Model</h3>
            <div className="space-y-2">
              {AVAILABLE_MODELS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    setCurrentModel(m.id);
                    setShowModelPicker(false);
                  }}
                  className={`w-full text-left p-3 rounded-[8px] border flex items-center justify-between transition-colors ${
                    currentModel === m.id ? "bg-[var(--surface-2)] border-[var(--accent)]" : "border-[var(--line)] hover:bg-[var(--surface-2)]/50"
                  }`}
                >
                  <div>
                    <p className="text-[13.5px] font-medium text-[var(--text)]">{m.name}</p>
                    <p className="text-[11px] text-[var(--text-3)]">Provider: {m.provider}</p>
                  </div>
                  {currentModel === m.id && <Check className="w-4 h-4 text-[var(--accent)]" />}
                </button>
              ))}
            </div>
            <Button className="w-full" onClick={() => setShowModelPicker(false)}>
              Close
            </Button>
          </div>
        </div>
      )}
      {showVoiceMode && (
        <VoiceMode
          onTranscript={(text) => {
            setInput(text);
            setShowVoiceMode(false);
          }}
          isThinking={loading}
          onClose={() => setShowVoiceMode(false)}
        />
      )}
    </div>
  );
}

const AVAILABLE_MODELS = [
  { id: "best-long-context", name: "Best Long Context (GLM-4.7)", provider: "9router" },
  { id: "cx/gpt-5.6-sol", name: "GPT-5.6 Sol", provider: "9router" },
  { id: "custom:9router", name: "9Router Router", provider: "9router" },
  { id: "claude-3-5-sonnet", name: "Claude 3.5 Sonnet", provider: "Anthropic" },
];
