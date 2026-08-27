"use client"

import { useEffect, useRef } from 'react'
import { 
  ExternalLink, Maximize2, Minimize2, RefreshCw, Loader2, 
  Wifi, WifiOff, ShieldCheck, AlertTriangle, Terminal, Sparkles
} from 'lucide-react'
import { motion } from 'framer-motion'

const OPENWEBUI_URL = "http://141.148.193.69:8085"

export default function OpenWebUIPage() {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isOnline, setIsOnline] = useState(false)
  const [showFullscreen, setShowFullscreen] = useState(false)

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return

    const handleLoad = () => {
      setIsLoading(false)
      setIsOnline(true)
    }

    const handleError = () => {
      setIsLoading(false)
      setIsOnline(false)
    }

    iframe.addEventListener('load', handleLoad)
    iframe.addEventListener('error', handleError)

    // Heartbeat check
    const interval = setInterval(() => {
      try {
        iframe.contentWindow?.postMessage({ type: 'heartbeat' }, OPENWEBUI_URL)
      } catch {}
    }, 30000)

    return () => {
      iframe.removeEventListener('load', handleLoad)
      iframe.removeEventListener('error', handleError)
      clearInterval(interval)
    }
  }, [])

  const reloadIframe = () => {
    setIsLoading(true)
    if (iframeRef.current) {
      iframeRef.current.src = OPENWEBUI_URL
    }
  }

  const openInNewTab = () => {
    window.open(OPENWEBUI_URL, '_blank', 'noopener,noreferrer')
  }

  const toggleFullscreen = () => {
    setShowFullscreen(!showFullscreen)
  }

  return (
    <div className={`h-screen w-full flex flex-col bg-[var(--bg)] ${showFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      {/* Header */}
      <header className="flex items-center justify-between h-14 px-4 border-b border-[var(--line)] bg-[var(--surface-1)] shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-[var(--text)]">OpenWebUI</h1>
              <p className="text-[10px] text-[var(--text-3)]">Hermes Agent Interface</p>
            </div>
          </div>
          
          {/* Status Indicators */}
          <div className="flex items-center gap-2 ml-4">
            <span className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full ${
              isOnline 
                ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                : isLoading 
                  ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' 
                  : 'bg-red-500/10 text-red-400 border border-red-500/20'
            }`}>
              {isLoading && <Loader2 className="w-3 h-3 animate-spin" />}
              {!isLoading && isOnline && <Wifi className="w-3 h-3" />}
              {!isLoading && !isOnline && <WifiOff className="w-3 h-3" />}
              {isLoading ? 'Loading...' : isOnline ? 'Connected' : 'Offline'}
            </span>
            
            <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <ShieldCheck className="w-3 h-3" />
              Hermes API: Active
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={reloadIframe}
            disabled={isLoading}
            className="p-2 rounded-lg hover:bg-[var(--surface-2)] text-[var(--text-3)] hover:text-[var(--accent)] transition-colors disabled:opacity-50"
            title="Reload"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg hover:bg-[var(--surface-2)] text-[var(--text-3)] hover:text-[var(--accent)] transition-colors"
            title={showFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {showFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          
          <button
            onClick={openInNewTab}
            className="p-2 rounded-lg hover:bg-[var(--surface-2)] text-[var(--text-3)] hover:text-[var(--accent)] transition-colors"
            title="Open in New Tab"
          >
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Iframe Container */}
      <div className="flex-1 relative overflow-hidden">
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 flex items-center justify-center bg-[var(--bg)] z-10"
          >
            <div className="text-center space-y-4">
              <Loader2 className="w-12 h-12 animate-spin text-[var(--accent)] mx-auto" />
              <div>
                <p className="text-[var(--text)] font-medium">Loading OpenWebUI...</p>
                <p className="text-[12px] text-[var(--text-3)]">Connecting to Hermes Agent gateway</p>
              </div>
            </div>
          </motion.div>
        )}

        {!isOnline && !isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute inset-0 flex items-center justify-center bg-[var(--bg)] z-10 p-8"
          >
            <div className="text-center space-y-6 max-w-md">
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
                <WifiOff className="w-8 h-8 text-red-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[var(--text)]">OpenWebUI Unavailable</h2>
                <p className="text-[var(--text-3)] mt-2">Could not connect to the OpenWebUI instance.</p>
              </div>
              <div className="space-y-2 text-[12px] text-[var(--text-4)]">
                <p>• Check if container <code className="px-1.5 py-0.5 bg-[var(--surface-2)] rounded">open-webui</code> is running</p>
                <p>• Verify port <code className="px-1.5 py-0.5 bg-[var(--surface-2)] rounded">8085</code> is accessible</p>
                <p>• Ensure Hermes gateway is running on <code className="px-1.5 py-0.5 bg-[var(--surface-2)] rounded">port 8081</code></p>
              </div>
              <button
                onClick={reloadIframe}
                className="mt-4 px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity"
              >
                <RefreshCw className="w-4 h-4 inline mr-1" />
                Retry Connection
              </button>
            </div>
          </motion.div>
        )}

        <iframe
          ref={iframeRef}
          src={OPENWEBUI_URL}
          className={`w-full h-full border-0 ${isLoading || !isOnline ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
          title="OpenWebUI - Hermes Agent Interface"
          allow="clipboard-read; clipboard-write"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads allow-modals allow-popups-to-escape-sandbox allow-storage-access-by-user-activation"
          style={{ 
            transform: isLoading || !isOnline ? 'scale(0.98)' : 'scale(1)',
            transition: 'transform 0.2s ease, opacity 0.3s ease'
          }}
        />
      </div>

      {/* Footer with Hermes Commands Reference */}
      <footer className="h-10 px-4 border-t border-[var(--line)] bg-[var(--surface-1)] shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-4 text-[11px] text-[var(--text-3)]">
          <span className="flex items-center gap-1">
            <Terminal className="w-3 h-3" />
            <span>Slash Commands:</span>
          </span>
          <span className="flex items-center gap-1">
            <code className="px-1.5 py-0.5 bg-[var(--bg)] rounded text-[10px] font-mono">/help</code>
            <code className="px-1.5 py-0.5 bg-[var(--bg)] rounded text-[10px] font-mono">/model</code>
            <code className="px-1.5 py-0.5 bg-[var(--bg)] rounded text-[10px] font-mono">/todo</code>
            <code className="px-1.5 py-0.5 bg-[var(--bg)] rounded text-[10px] font-mono">/cron</code>
            <code className="px-1.5 py-0.5 bg-[var(--bg)] rounded text-[10px] font-mono">/skills</code>
            <code className="px-1.5 py-0.5 bg-[var(--bg)] rounded text-[10px] font-mono">/memory</code>
            <code className="px-1.5 py-0.5 bg-[var(--bg)] rounded text-[10px] font-mono">/status</code>
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-[var(--text-4)]">
          <span>Hermes API: <code className="px-1.5 py-0.5 bg-[var(--bg)] rounded">http://172.17.0.1:8081/v1</code></span>
          <span>|</span>
          <span>OpenWebUI: <code className="px-1.5 py-0.5 bg-[var(--bg)] rounded">port 8085</code></span>
        </div>
      </footer>
    </div>
  )
}

// Need to import useState
import { useState } from 'react'