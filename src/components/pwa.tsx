"use client"
import { useState, useEffect } from "react"

export function usePWA() {
  const [installPrompt, setInstallPrompt] = useState<any>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [online, setOnline] = useState(true)

  useEffect(() => {
    // Register service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {})
    }
    // Detect standalone (installed PWA)
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches
    setIsInstalled(isStandalone)
    // Capture install prompt
    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e)
    }
    const onInstalled = () => {
      setInstallPrompt(null)
      setIsInstalled(true)
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall)
    window.addEventListener("appinstalled", onInstalled)
    // Online/offline tracking
    const onOnline = () => setOnline(true)
    const onOffline = () => setOnline(false)
    window.addEventListener("online", onOnline)
    window.addEventListener("offline", onOffline)
    setOnline(navigator.onLine)
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall)
      window.removeEventListener("appinstalled", onInstalled)
      window.removeEventListener("online", onOnline)
      window.removeEventListener("offline", onOffline)
    }
  }, [])

  const promptInstall = async () => {
    if (!installPrompt) return
    installPrompt.prompt()
    await installPrompt.userChoice
    setInstallPrompt(null)
  }

  return { installPrompt, isInstalled, online, promptInstall }
}

export function InstallBanner() {
  const { installPrompt, promptInstall } = usePWA()
  const [dismissed, setDismissed] = useState(false)

  if (!installPrompt || dismissed) return null

  return (
    <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 install-banner rounded-2xl px-4 py-3 flex items-center gap-3 shadow-2xl shadow-black/50 fade-in-up">
      <div className="w-9 h-9 rounded-xl bg-[var(--accent)]/20 flex items-center justify-center text-base">⚡</div>
      <div>
        <p className="text-[12px] font-semibold text-[var(--text)]">Install GlyteOS</p>
        <p className="text-[10px] text-[var(--text-3)]">Quick access like a native app</p>
      </div>
      <button
        onClick={promptInstall}
        className="text-[11px] px-3 py-1.5 rounded-full bg-[var(--accent)] text-black font-semibold hover:opacity-90 transition-all"
      >
        Install
      </button>
      <button onClick={() => setDismissed(true)} className="text-[var(--text-4)] hover:text-[var(--text-3)] p-1">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

function X({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  )
}