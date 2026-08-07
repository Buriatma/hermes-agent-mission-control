"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Mic, MicOff, Volume2, VolumeX, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/kit";

interface VoiceModeProps {
  onTranscript: (text: string) => void;
  isThinking: boolean;
  onClose: () => void;
}

export default function VoiceMode({ onTranscript, isThinking, onClose }: VoiceModeProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      recognitionRef.current.start();
      setIsListening(true);
      setError(null);
    } catch (err) {
      console.error("STT error:", err);
    }
  }, []);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return;
    recognitionRef.current.stop();
    setIsListening(false);
  }, []);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("Speech recognition not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      let currentTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        currentTranscript += event.results[i][0].transcript;
      }
      setTranscript(currentTranscript);

      if (event.results[0].isFinal) {
        const final = currentTranscript.trim();
        // Wake-word detection: "Jarvis" or "Hermes"
        if (final.toLowerCase().includes("jarvis") || final.toLowerCase().includes("hermes")) {
          const cleanText = final.replace(/jarvis|hermes/gi, "").trim();
          if (cleanText) onTranscript(cleanText);
        } else {
          onTranscript(final);
        }
        setIsListening(false);
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error !== "no-speech") {
        setError(`Error: ${event.error}`);
        setIsListening(false);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
  }, [onTranscript]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md animate-in fade-in zoom-in duration-200">
      <div className="w-full max-w-sm flex flex-col items-center text-center">
        {/* Pulse Visualizer */}
        <div className="relative mb-12">
          <div className={`absolute inset-0 rounded-full bg-[var(--accent)] opacity-20 ${isListening ? "animate-ping" : ""}`} />
          <div className={`relative w-24 h-24 rounded-full flex items-center justify-center border-2 ${isListening ? "border-[var(--accent)]" : "border-[var(--line)]"} bg-[var(--surface-1)] transition-colors`}>
            {isListening ? <Mic className="w-8 h-8 text-[var(--accent)]" /> : <MicOff className="w-8 h-8 text-[var(--text-4)]" />}
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-[20px] font-semibold text-[var(--text)]">
            {isThinking ? "Hermes is thinking…" : isListening ? "Listening…" : "Voice Mode Active"}
          </h2>
          <p className="text-[14px] text-[var(--text-3)] max-w-xs min-h-[1.5em]">
            {isThinking ? "Hang on a second…" : transcript || "Say 'Jarvis' followed by your command."}
          </p>
          {error && <p className="text-red-400 text-[12px]">{error}</p>}
        </div>

        <div className="mt-12 flex items-center gap-4">
          <Button variant={isListening ? "ghost" : "primary"} onClick={isListening ? stopListening : startListening} disabled={isThinking}>
            {isListening ? "Stop" : "Talk"}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            <X className="w-4 h-4" />
            Close
          </Button>
        </div>

        <div className="mt-8 flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--surface-2)] border border-[var(--line)]">
          <Zap className="w-3.5 h-3.5 text-[var(--accent)]" />
          <span className="text-[10px] uppercase tracking-wider font-bold text-[var(--text-4)]">Jarvis Protocol</span>
        </div>
      </div>
    </div>
  );
}
