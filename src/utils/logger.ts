export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export type LogEntry = {
  level: LogLevel
  message: string
  data?: any
  time: string
}

type Listener = (entry: LogEntry) => void

class Logger {
  private entries: LogEntry[] = []
  private listeners: Set<Listener> = new Set()

  subscribe(listener: Listener) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getEntries() { return this.entries }
  clear() { this.entries = []; this.emit({ level: 'info', message: 'Logs cleared', time: new Date().toISOString() }) }

  private emit(entry: LogEntry) {
    this.entries.push(entry)
    this.listeners.forEach(l => l(entry))
  }

  private log(level: LogLevel, message: string, data?: any) {
    const entry: LogEntry = { level, message, data, time: new Date().toISOString() }
    // still mirror to console for devtools
    switch (level) {
      case 'debug': console.debug(message, data ?? ''); break
      case 'info': console.info(message, data ?? ''); break
      case 'warn': console.warn(message, data ?? ''); break
      case 'error': console.error(message, data ?? ''); break
    }
    this.emit(entry)
  }

  debug(message: string, data?: any) { this.log('debug', message, data) }
  info(message: string, data?: any) { this.log('info', message, data) }
  warn(message: string, data?: any) { this.log('warn', message, data) }
  error(message: string, data?: any) { this.log('error', message, data) }
}

export const logger = new Logger()
