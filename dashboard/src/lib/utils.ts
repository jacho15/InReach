import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { NextResponse } from "next/server"
import { z } from "zod"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ── API Error Handling ──

export function handleApiError(error: unknown) {
  if (error instanceof z.ZodError) {
    return NextResponse.json({ error: error.issues }, { status: 400 })
  }
  if (error instanceof Error && error.message === "Unauthorized") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  return NextResponse.json({ error: "Internal server error" }, { status: 500 })
}

// ── Time Formatting ──

export function timeAgo(dateStr: string | null) {
  if (!dateStr) return "Never"
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "Just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

// ── Status Color Maps ──

export const STATUS_COLORS: Record<string, string> = {
  // Contact statuses
  sent: "bg-blue-100 text-blue-800",
  accepted: "bg-green-100 text-green-800",
  pending: "bg-yellow-100 text-yellow-800",
  skipped: "bg-gray-100 text-gray-800",
  error: "bg-red-100 text-red-800",
  // Campaign statuses
  active: "bg-green-100 text-green-800",
  paused: "bg-yellow-100 text-yellow-800",
  completed: "bg-blue-100 text-blue-800",
  archived: "bg-gray-100 text-gray-800",
  // Activity types
  page_complete: "bg-purple-100 text-purple-800",
  campaign_started: "bg-green-100 text-green-800",
  campaign_stopped: "bg-yellow-100 text-yellow-800",
}

// ── Activity Display ──

export function getActivityDisplay(data: Record<string, unknown> | null): string {
  if (!data) return ""
  return (
    (data.name as string) ||
    (data.profileUrl as string) ||
    (data.reason as string) ||
    JSON.stringify(data).substring(0, 100)
  )
}

// ── CSV Escaping ──

export function escapeCSV(value: string): string {
  const escaped = value.replace(/"/g, '""')
  return `"${escaped}"`
}
