"use client"
import { useState, useEffect, useRef, useCallback } from "react"
import { Mic, Square, Send, X, ChevronDown, ChevronUp } from "lucide-react"

// Browser-native STT as progressive enhancement. Falls back gracefully.
function useSpeechToText() {
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState("")
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<any>(null)

  const start = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setError("Speech recognition not supported in this browser")
      return
    }
    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = "en-US"
    recognitionRef.current = recognition

    recognition.onresult = (event: any) => {
      let text = ""
      for (let i = 0; i < event.results.length; i++) {
        text += event.results[i][0].transcript
      }
      setTranscript(text)
    }
    recognition.onerror = (event: any) => {
      setError(event.error)
      setListening(false)
    }
    recognition.onend = () => setListening(false)

    try {
      recognition.start()
      setListening(true)
      setError(null)
    } catch (e) {
      setError("Mic access denied")
    }
  }, [])

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch {}
    }
    setListening(false)
  }, [])

  const reset = useCallback(() => {
    setTranscript("")
    setError(null)
  }, [])

  return { listening, transcript, error, start, stop, reset }
}

export function VoiceInput({ onSend, disabled }: { onSend: (text: string) => void; disabled: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const { listening, transcript, error, start, stop, reset } = useSpeechToText()
  const timerRef = useRef<any>(null)

  const handleHoldStart = () => {
    if (disabled) return
    reset()
    start()
    // Auto-stop after 30s to prevent runaway
    timerRef.current = setTimeout(() => { if (listening) stop() }, 30000)
  }

  const handleHoldEnd = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    stop()
    if (transcript.trim()) {
      onSend(transcript.trim())
      reset()
    }
  }

  return (
    <div className="flex flex-col items-center gap-1">
      {/* Main mic button */}
      <button
        onMouseDown={handleHoldStart}
        onMouseUp={handleHoldEnd}
        onTouchStart={(e) => { e.preventDefault(); handleHoldStart() }}
        onTouchEnd={(e) => { e.preventDefault(); handleHoldEnd() }}
        disabled={disabled}
        className={`relative w-12 h-12 rounded-full flex items-center justify-center transition-all ${
          listening
            ? "bg-gradient-to-br from-[var(--accent)] to-[#00c8ff] text-black shadow-lg shadow-[var(--accent)]/40 scale-110"
            : "bg-[var(--surface-2)] border border-[var(--line)] text-[var(--text-3)] hover:text-[var(--accent)] hover:border-[var(--accent)]/50"
        } ${disabled ? "opacity-30 cursor-not-allowed" : "active:scale-95"}`}
        title={listening ? "Release to send" : "Hold to talk"}
      >
        {listening ? (
          <div className="flex items-center gap-0.5">
            <Square className="w-4 h-4 fill-current" />
          </div>
        ) : (
          <Mic className="w-5 h-5" />
        )}
        {listening && (
          <span className="absolute inset-0 rounded-full bg-[var(--accent)] animate-ping opacity-40" />
        )}
      </button>

      {/* Expanded view - transcript + status */}
      {expanded && (
        <div className="w-full max-w-md space-y-2 fade-in-up">
          {listening && (
            <div className="flex items-center justify-center gap-1.5 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] animate-bounce" style={{ animationDelay: "300ms" }} />
              <span className="text-[10px] text-[var(--text-3)] ml-2">Listening...</span>
            </div>
          )}
          {transcript && (
            <div className="px-3 py-2 rounded-xl bg-[var(--surface-1)] border border-[var(--line)] text-[12px] text-[var(--text-2)]">
              "{transcript}"
            </div>
          )}
          {error && (
            <div className="px-3 py-2 rounded-xl bg-[var(--down)]/10 border border-[var(--down)]/30 text-[11px] text-[var(--down)]">
              {error}
            </div>
          )}
        </div>
      )}

      {/* Toggle expand */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-[10px] text-[var(--text-4)] hover:text-[var(--text-3)] transition-colors"
      >
        {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
    </div>
  )
}
