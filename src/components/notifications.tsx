"use client"
import { useCallback } from "react"

export function useNotifications() {
  const requestPermission = useCallback(async () => {
    if (!("Notification" in window)) return false
    if (Notification.permission === "granted") return true
    if (Notification.permission === "denied") return false
    return await Notification.requestPermission() === "granted"
  }, [])

  const notify = useCallback((title: string, body: string, tag?: string) => {
    if (!("Notification" in window) || Notification.permission !== "granted") return
    try {
      new Notification(title, {
        body,
        icon: "https://ik.imagekit.io/ecuuhbi4w/Glyte-GPT%20logo.png?updatedAt=1755967856964",
        badge: "https://ik.imagekit.io/ecuuhbi4w/Glyte-GPT%20logo.png?updatedAt=1755967856964",
        tag: tag || "glyteos",
        silent: false,
      })
    } catch {}
  }, [])

  return { requestPermission, notify }
}