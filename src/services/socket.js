/**
 * socket.js — Cliente WebSocket usando Socket.IO.
 * La librería se carga dinámicamente solo cuando el visitante abre el chat.
 */

const BACKEND_URL = __BACKEND_URL__
const SOCKET_IO_CDN = `${BACKEND_URL}/socket.io/socket.io.js`
const WIDGET_NS = `${BACKEND_URL}/widget`

let _io = null
let _loadPromise = null

function loadSocketIO() {
  if (_loadPromise) return _loadPromise
  _loadPromise = new Promise((resolve, reject) => {
    if (window.io) return resolve(window.io)
    const script = document.createElement('script')
    script.src = SOCKET_IO_CDN
    script.onload = () => resolve(window.io)
    script.onerror = reject
    document.head.appendChild(script)
  })
  return _loadPromise
}

export class SocketService {
  constructor(sessionId) {
    this.sessionId = sessionId
    this.socket = null
    this.listeners = new Map()
    this.pendingMessages = []
    this._reconnectAttempts = 0
  }

  async connect() {
    const io = await loadSocketIO()
    // Conectar al namespace /widget (sin JWT, solo session_id)
    this.socket = io(WIDGET_NS, {
      auth: { session_id: this.sessionId },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      reconnectionAttempts: Infinity,
    })

    // Esperar a que la conexión esté establecida antes de resolver
    await new Promise((resolve) => {
      let done = false
      const finish = () => { if (!done) { done = true; resolve() } }

      this.socket.once('connect', finish)
      this.socket.once('connect_error', finish) // Resolver igual para no bloquear
      setTimeout(finish, 5000) // Timeout de seguridad
    })

    this.socket.on('connect', () => {
      this._reconnectAttempts = 0
      this._emit('connection:status', { connected: true })
      // Reenviar mensajes pendientes tras reconexión
      for (const msg of this.pendingMessages) {
        this.socket.emit(msg.event, msg.data)
      }
      this.pendingMessages = []
    })

    this.socket.on('disconnect', (reason) => {
      this._emit('connection:status', { connected: false, reason })
    })

    this.socket.on('connect_error', (err) => {
      this._reconnectAttempts++
      this._emit('connection:error', { error: err.message, attempt: this._reconnectAttempts })
    })

    // Eventos del dominio
    const domainEvents = ['new:message', 'typing:start', 'typing:stop',
      'conversation:assigned', 'conversation:resolved', 'conversation:status_changed']
    for (const event of domainEvents) {
      this.socket.on(event, (data) => this._emit(event, data))
    }
  }

  joinConversation(convId) {
    return new Promise((resolve) => {
      if (!this.socket?.connected) { resolve(); return }
      let done = false
      const finish = () => { if (!done) { done = true; resolve() } }
      this.socket.emit('join:conversation', { conversationId: convId }, finish)
      setTimeout(finish, 1500)  // fallback si el servidor no envía ACK
    })
  }

  on(event, handler) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set())
    this.listeners.get(event).add(handler)
    return () => this.listeners.get(event)?.delete(handler)
  }

  _emit(event, data) {
    for (const handler of this.listeners.get(event) ?? []) {
      try { handler(data) } catch {}
    }
  }

  disconnect() {
    this.socket?.disconnect()
    this.socket = null
  }
}
