// Local repository adapter (SPEC.md §7.2): persists the whole DB in
// localStorage and notifies React via useSyncExternalStore. The Supabase
// adapter would implement the same load/mutate surface against PostgreSQL
// with RLS; domain rules stay in waitlist.ts either way.

import { useSyncExternalStore } from 'react'
import type { DB } from './types'
import { buildSeed } from './seed'
import { expireOffers } from './waitlist'

const KEY = 'idn-db-v1'

let db: DB | null = null
let version = 0
const listeners = new Set<() => void>()

function hasStorage(): boolean {
  return typeof localStorage !== 'undefined'
}

function persist(): void {
  if (db && hasStorage()) localStorage.setItem(KEY, JSON.stringify(db))
}

function emit(): void {
  version += 1
  for (const fn of listeners) fn()
}

export function loadDB(): DB {
  if (db) return db
  if (hasStorage()) {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      try {
        db = JSON.parse(raw) as DB
      } catch {
        db = null
      }
    }
  }
  if (!db) {
    db = buildSeed()
    persist()
  }
  // Offer-expiry sweep on load — stands in for the scheduled server job (§7.3).
  if (expireOffers(db, new Date().toISOString()) > 0) persist()
  return db
}

export function mutate<T>(fn: (db: DB) => T): T {
  const d = loadDB()
  const result = fn(d)
  persist()
  emit()
  return result
}

export function resetDemo(): void {
  if (hasStorage()) localStorage.removeItem(KEY)
  db = buildSeed()
  persist()
  emit()
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

// Components re-render on every mutation and read the DB synchronously.
export function useDB(): DB {
  useSyncExternalStore(subscribe, () => version)
  return loadDB()
}

export function nowIso(): string {
  return new Date().toISOString()
}
