import React, { useEffect, useState } from 'react'
import { logger, LogEntry } from '../utils/logger'

export function DebugPanel({ open, onClear }: { open: boolean; onClear: () => void }) {
  const [entries, setEntries] = useState<LogEntry[]>(logger.getEntries())

  useEffect(() => {
    const unsub = logger.subscribe(() => setEntries([...logger.getEntries()]))
    return () => { unsub() }
  }, [])

  if (!open) return null
  return (
    <div style={{ position: 'fixed', right: 8, bottom: 8, width: '34vw', maxHeight: '40vh', background: '#111', color: '#eee', borderRadius: 8, padding: 8, fontSize: 12, overflow: 'auto', boxShadow: '0 2px 12px rgba(0,0,0,0.4)', zIndex: 9999 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <strong>Debug Log</strong>
        <button onClick={onClear} style={{ background: '#333', color: '#fff', border: '1px solid #555', borderRadius: 4, padding: '2px 8px' }}>Clear</button>
      </div>
      {entries.length === 0 ? <div>No logs</div> : null}
      {entries.map((e, i) => (
        <div key={i} style={{ marginBottom: 4 }}>
          <span style={{ color: '#888' }}>[{e.time}]</span> <span style={{ color: levelColor(e.level) }}>{e.level.toUpperCase()}</span> - {e.message}
          {e.data !== undefined ? <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{safeStringify(e.data)}</pre> : null}
        </div>
      ))}
    </div>
  )
}

function safeStringify(v: any) {
  try { return JSON.stringify(v, null, 2) } catch { return String(v) }
}

function levelColor(level: string) {
  switch (level) {
    case 'debug': return '#6cf'
    case 'info': return '#9f9'
    case 'warn': return '#fd6'
    case 'error': return '#f66'
    default: return '#fff'
  }
}
