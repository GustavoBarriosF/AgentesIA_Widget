/**
 * core.js — Cerebro del widget. Máquina de estados + coordinador.
 * No renderiza nada. Coordina Session, Api, Socket, LeadDetector.
 */

import { Session } from './session.js'
import { Api } from './services/api.js'
import { SocketService } from './services/socket.js'
import { LeadDetector } from './services/lead-detector.js'
import { loadConfig } from './config.js'

// Estados posibles del widget
export const STATE = {
  UNINITIALIZED: 'UNINITIALIZED',
  LOADING:       'LOADING',
  IDLE:          'IDLE',
  OPEN:          'OPEN',
  CONNECTING:    'CONNECTING',
  RECONNECTING:  'RECONNECTING',
  UPLOADING:     'UPLOADING',
  RECORDING:     'RECORDING',
  ERROR:         'ERROR',
}

export class Core {
  constructor(slug) {
    this.slug = slug
    this.state = STATE.UNINITIALIZED
    this.config = null
    this.session = null
    this.api = null
    this.socket = null
    this.leadDetector = null
    this.listeners = new Map()

    // Estado de la conversación
    this.conversationId = null
    this.contactId = null
    this.messages = []
    this.unreadCount = 0
    this.isTyping = false
    this._typingTimeout = null
    this._pendingOpen = false  // El usuario quiso abrir mientras init() estaba en progreso
  }

  async init() {
    this._setState(STATE.LOADING)
    try {
      this.config = await loadConfig(this.slug, 'tmp')
      this.session = new Session(this.config.workspace_id)
      this.api = new Api(this.session.sessionId)
      this.config = await this.api.getConfig(this.slug) // Con session_id real

      this.leadDetector = new LeadDetector(({ type, value }) => {
        this._handleLeadDetected(type, value)
      })

      // Restaurar estado de sesión previa
      this.conversationId = this.session.conversationId
      this.contactId = this.session.contactId
      this.unreadCount = this.session.unreadCount
      this.messages = this.session.getCachedMessages()

      this._setState(STATE.IDLE)
      this._emit('initialized', { config: this.config, unreadCount: this.unreadCount })

      // Abrir si: había conversación abierta, O el usuario hizo clic mientras cargaba
      if (this._pendingOpen || (this.session.isOpen && this.conversationId)) {
        this._pendingOpen = false
        await this.open()
      }
    } catch (err) {
      this._setState(STATE.ERROR)
      this._emit('error', { message: err.message })
    }
  }

  async open() {
    if (this.state === STATE.OPEN) return

    // Si init() falló o no se ejecutó, reintentarlo antes de abrir
    if (this.state === STATE.ERROR || this.state === STATE.UNINITIALIZED) {
      await this.init()
      if (this.state !== STATE.IDLE) return  // Sigue fallando
    }

    // Si aún está cargando, marcar intención y esperar a que init() termine
    if (this.state === STATE.LOADING) {
      this._pendingOpen = true
      return
    }

    this._setState(STATE.OPEN)
    this.session.isOpen = true
    this.unreadCount = 0
    this.session.unreadCount = 0
    this._emit('opened')

    // Cargar historial si hay conversación previa
    if (this.conversationId) {
      // Mostrar caché inmediatamente si existe
      if (this.messages.length > 0) {
        this._emit('messages:loaded', { messages: this.messages })
      }
      // Siempre refrescar desde el servidor (incluye mensajes perdidos en desconexión)
      try {
        const { messages } = await this.api.getMessages(this.conversationId)
        this.messages = messages
        this.session.setCachedMessages(messages)
        this._emit('messages:loaded', { messages })
      } catch (err) {
        // Conversación ya no existe en el backend — limpiar estado para empezar nueva
        if (err?.status === 404) {
          this._resetConversation()
          this._emit('messages:loaded', { messages: [] })
        }
      }
    }

    // Conectar WebSocket
    await this._connectSocket()
    if (this.conversationId) {
      this.socket.joinConversation(this.conversationId)
      this.api.markAsRead(this.conversationId).catch(() => {})
    }
  }

  close() {
    if (this.state !== STATE.OPEN) return
    this._setState(STATE.IDLE)
    this.session.isOpen = false
    this._emit('closed')
  }

  toggle() {
    if (this.state === STATE.OPEN) this.close()
    else this.open()
  }

  async sendMessage(text) {
    if (!text?.trim()) return
    const content = text.trim()

    // Mensaje optimista en UI
    const tempId = `tmp_${Date.now()}`
    const tempMsg = {
      _id: tempId,
      sender_type: 'contact',
      type: 'text',
      content,
      createdAt: new Date().toISOString(),
      _pending: true,
    }
    this.messages.push(tempMsg)
    this._emit('message:pending', { message: tempMsg })

    // Crear conversación si no existe
    if (!this.conversationId) {
      try {
        const result = await this.api.createConversation({
          workspaceId: this.config.workspace_id,
          channelId:   this.config.channel_id,
          metadata:    this.session.preChatData || {},
        })
        this.session.preChatData = null
        this.conversationId = result.conversation_id
        this.contactId      = result.contact_id
        this.session.conversationId = this.conversationId
        this.session.contactId      = this.contactId

        // Esperar confirmación del socket join antes de enviar el mensaje
        // (evita la condición de carrera donde el bot responde antes de que el widget esté en la sala)
        if (this.socket) {
          await this.socket.joinConversation(this.conversationId)
        }

        // Obtener mensajes ya guardados en BD (ej. mensaje de bienvenida del bot)
        try {
          const { messages: existing } = await this.api.getMessages(this.conversationId)
          for (const msg of existing) {
            if (!this.messages.find(m => m._id === msg._id)) {
              this.messages.push(msg)
              this._emit('message:received', { message: msg })
            }
          }
          this.session.setCachedMessages(this.messages)
        } catch {}
      } catch (err) {
        this._removeTempMessage(tempId)
        this._emit('error', { message: 'No se pudo iniciar la conversación.' })
        return
      }
    }

    // Analizar para lead detection (después de que el contacto ya existe en BD)
    this.leadDetector?.analyze(content)

    try {
      await this.api.sendMessage(this.conversationId, content)
      this._confirmTempMessage(tempId)
    } catch (err) {
      this._removeTempMessage(tempId)
      if (err?.status === 404) {
        // La conversación fue eliminada — resetear y reenviar como nueva
        this._resetConversation()
        this.messages = []
        this._emit('messages:loaded', { messages: [] })
        await this.sendMessage(content)
      } else {
        this._emit('error', { message: 'No se pudo enviar el mensaje.' })
      }
    }
  }

  async uploadFile(file) {
    if (!this.conversationId) {
      await this._ensureConversation()
    }
    this._setState(STATE.UPLOADING)
    try {
      const result = await this.api.uploadFile(this.conversationId, file)
      this._setState(STATE.OPEN)
      // Mostrar el archivo inmediatamente en el chat usando la respuesta de la API
      if (result?.message_id && result?.url) {
        const isImage = (result.mimetype || '').startsWith('image/')
        const msg = {
          _id: result.message_id,
          sender_type: 'contact',
          type: isImage ? 'image' : 'file',
          content: result.filename || file.name,
          attachments: [{
            url:       result.url,
            filename:  result.filename || file.name,
            mime_type: result.mimetype || file.type,
            size_bytes: result.size || file.size,
          }],
          createdAt: result.created_at || new Date().toISOString(),
        }
        this.messages.push(msg)
        this.session.setCachedMessages(this.messages)
        this._emit('message:received', { message: msg })
      }
      return result
    } catch (err) {
      this._setState(STATE.OPEN)
      this._emit('error', { message: 'No se pudo subir el archivo.' })
    }
  }

  identify(data) {
    if (!this.session) return
    const update = {}
    if (data.name)  update.name  = data.name
    if (data.email) update.email = data.email
    if (data.phone) update.phone = data.phone
    if (Object.keys(update).length > 0) {
      this.api.updateContact(this.session.sessionId, this.config.workspace_id, update).catch(() => {})
    }
  }

  on(event, handler) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set())
    this.listeners.get(event).add(handler)
    return () => this.listeners.get(event)?.delete(handler)
  }

  submitPreChatForm(data) {
    if (!this.session) return
    this.session.preChatFormDone = true
    const update = {}
    if (data.phone)          update.phone          = data.phone
    if (data.email)          update.email          = data.email
    if (data.identification) update.identification = data.identification
    if (Object.keys(update).length > 0) {
      this.session.preChatData = update
    }
  }

  skipPreChatForm() {
    if (this.session) this.session.preChatFormDone = true
  }

  destroy() {
    this.socket?.disconnect()
    this.socket = null
    this._emit('destroyed')
  }

  // ── Privados ───────────────────────────────────────────────────────────

  async _connectSocket() {
    if (this.socket) return
    // No sobreescribir STATE.OPEN si ya fue seteado por open()
    if (this.state !== STATE.OPEN) this._setState(STATE.CONNECTING)
    try {
      this.socket = new SocketService(this.session.sessionId)
      await this.socket.connect()

      this.socket.on('connection:status', ({ connected }) => {
        if (connected) {
          // Re-unirse a la sala de conversación tras reconexión (el backend reinició o hubo corte)
          if (this.conversationId) {
            this.socket.joinConversation(this.conversationId)
          }
          if (this.state === STATE.RECONNECTING) {
            this._setState(STATE.OPEN)
            this._emit('connection:restored')
          }
        }
      })

      this.socket.on('connection:error', (data) => {
        this._setState(STATE.RECONNECTING)
        this._emit('connection:error', data)
      })

      this.socket.on('new:message', (msg) => {
        // Ignorar mensajes del propio visitante — ya se muestran como optimistas
        if (msg.sender_type === 'contact') return

        clearTimeout(this._typingTimeout)
        this.isTyping = false
        this._emit('typing:changed', { isTyping: false })

        // Evitar duplicados (puede llegar por socket un mensaje ya cargado vía HTTP)
        if (this.messages.find(m => m._id === msg._id)) return

        this.messages.push(msg)
        this.session.setCachedMessages(this.messages)
        if (this.state !== STATE.OPEN) {
          this.unreadCount++
          this.session.unreadCount = this.unreadCount
          this._emit('unread:changed', { count: this.unreadCount })
        } else if (this.conversationId) {
          this.api.markAsRead(this.conversationId).catch(() => {})
        }
        this._emit('message:received', { message: msg })
      })

      this.socket.on('typing:start', () => {
        this.isTyping = true
        this._emit('typing:changed', { isTyping: true })
        // Auto-apagar el indicador si no llega typing:stop ni new:message en 10 segundos
        clearTimeout(this._typingTimeout)
        this._typingTimeout = setTimeout(() => {
          if (this.isTyping) {
            this.isTyping = false
            this._emit('typing:changed', { isTyping: false })
          }
        }, 5000)
      })

      this.socket.on('typing:stop', () => {
        clearTimeout(this._typingTimeout)
        this.isTyping = false
        this._emit('typing:changed', { isTyping: false })
      })

      this.socket.on('conversation:assigned', (data) => {
        this._emit('conversation:assigned', data)
      })

      this.socket.on('conversation:resolved', (data) => {
        // Guardar el ID antes de resetear (para la encuesta)
        this._resolvedConvId = this.conversationId
        // Resetear conversación: la próxima vez que el cliente escriba, se crea una nueva
        this._resetConversation()
        this._emit('conversation:resolved', data)
      })

      if (this.state !== STATE.OPEN) this._setState(STATE.OPEN)
    } catch (err) {
      this._setState(STATE.ERROR)
      this._emit('error', { message: 'No se pudo conectar al servidor.' })
    }
  }

  async _ensureConversation() {
    if (this.conversationId) return
    const result = await this.api.createConversation({
      workspaceId: this.config.workspace_id,
      channelId:   this.config.channel_id,
      metadata:    this.session.preChatData || {},
    })
    this.session.preChatData = null
    this.conversationId = result.conversation_id
    this.contactId      = result.contact_id
    this.session.conversationId = this.conversationId
    this.session.contactId      = this.contactId
    this.socket?.joinConversation(this.conversationId)
  }

  async _handleLeadDetected(type, value) {
    if (!this.session) return
    try {
      await this.api.updateContact(this.session.sessionId, this.config.workspace_id, { [type]: value })
    } catch {}
  }

  async submitSurvey(conversationId, score, comment) {
    try {
      await this.api.submitSurvey(conversationId, score, comment)
    } catch {}
    if (this.session) this.session.pendingSurvey = null
  }

  _resetConversation() {
    this.conversationId = null
    this.contactId = null
    this.messages = []
    this.unreadCount = 0
    this.session.conversationId = null
    this.session.contactId = null
    this.session.unreadCount = 0
    this.session.setCachedMessages([])
    // Generar nuevo session_id para que el próximo visitante sea un contacto nuevo
    const newSessionId = this.session.resetSessionId()
    this.api = new Api(newSessionId)
  }

  _setState(newState) {
    const prev = this.state
    this.state = newState
    this._emit('state:changed', { state: newState, prev })
  }

  _emit(event, data = {}) {
    for (const handler of this.listeners.get(event) ?? []) {
      try { handler(data) } catch {}
    }
  }

  _removeTempMessage(tempId) {
    this.messages = this.messages.filter(m => m._id !== tempId)
    this._emit('message:removed', { tempId })
  }

  _confirmTempMessage(tempId) {
    const msg = this.messages.find(m => m._id === tempId)
    if (msg) {
      delete msg._pending
      this._emit('message:confirmed', { tempId })
    }
  }
}
