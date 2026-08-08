"use client"
import { useEffect, useState } from 'react'
import { Sun, Moon } from 'lucide-react'

export function ThemeToggle(){
  const [light,setLight]=useState(false)
  useEffect(()=>{
    const saved=typeof window!=='undefined'?localStorage.getItem('hermes-theme'):null
    if(saved==='light'){setLight(true);document.documentElement.classList.add('light')}
  },[])
  const toggle=()=>{
    const next=!light
    setLight(next)
    if(next)document.documentElement.classList.add('light')
    else document.documentElement.classList.remove('light')
    localStorage.setItem('hermes-theme',next?'light':'dark')
  }
  return(
    <button onClick={toggle} title="Toggle theme" className="fixed top-3 right-3 z-40 w-8 h-8 rounded-lg bg-[var(--surface-1)] border border-[var(--line)] flex items-center justify-center text-[var(--text-2)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-colors">
      {light?<Moon className="w-4 h-4"/>:<Sun className="w-4 h-4"/>}
    </button>
  )
}
