/**
 * session.js — Identidad persistente del visitante anónimo.
 * Genera o recupera un session_id único por workspace desde localStorage.
 */

const STORAGE_PREFIX = 'trivox_'

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export class Session {
  constructor(workspaceId) {
    this.workspaceId = workspaceId
    this.prefix = `${STORAGE_PREFIX}${workspaceId}_`
    // Si no hay conversación activa, generar un nuevo session_id.
    // Esto garantiza que cada visitante nuevo (misma PC, distinta persona)
    // tenga su propio contacto en lugar de reutilizar el anterior.
    if (!this.conversationId) {
      localStorage.setItem(`${this.prefix}session_id`, generateUUID())
    }
  }

  get sessionId() {
    let id = localStorage.getItem(`${this.prefix}session_id`)
    if (!id) {
      id = generateUUID()
      localStorage.setItem(`${this.prefix}session_id`, id)
    }
    return id
  }

  resetSessionId() {
    const newId = generateUUID()
    localStorage.setItem(`${this.prefix}session_id`, newId)
    return newId
  }

  get conversationId() {
    return localStorage.getItem(`${this.prefix}conv_id`) || null
  }

  set conversationId(id) {
    if (id) localStorage.setItem(`${this.prefix}conv_id`, id)
    else localStorage.removeItem(`${this.prefix}conv_id`)
  }

  get contactId() {
    return localStorage.getItem(`${this.prefix}contact_id`) || null
  }

  set contactId(id) {
    if (id) localStorage.setItem(`${this.prefix}contact_id`, id)
    else localStorage.removeItem(`${this.prefix}contact_id`)
  }

  get isOpen() {
    return localStorage.getItem(`${this.prefix}open`) === '1'
  }

  set isOpen(val) {
    localStorage.setItem(`${this.prefix}open`, val ? '1' : '0')
  }

  get unreadCount() {
    return parseInt(localStorage.getItem(`${this.prefix}unread`) || '0', 10)
  }

  set unreadCount(n) {
    localStorage.setItem(`${this.prefix}unread`, String(n))
  }

  getCachedMessages() {
    try {
      return JSON.parse(localStorage.getItem(`${this.prefix}messages`) || '[]')
    } catch {
      return []
    }
  }

  get pendingSurvey() {
    try { return JSON.parse(localStorage.getItem(`${this.prefix}pending_survey`) || 'null') } catch { return null }
  }

  set pendingSurvey(data) {
    if (data) localStorage.setItem(`${this.prefix}pending_survey`, JSON.stringify(data))
    else localStorage.removeItem(`${this.prefix}pending_survey`)
  }

  get preChatFormDone() {
    return localStorage.getItem(`${this.prefix}pre_chat_done`) === '1'
  }

  set preChatFormDone(val) {
    localStorage.setItem(`${this.prefix}pre_chat_done`, val ? '1' : '0')
  }

  get preChatData() {
    try { return JSON.parse(localStorage.getItem(`${this.prefix}pre_chat_data`) || 'null') } catch { return null }
  }

  set preChatData(data) {
    if (data) localStorage.setItem(`${this.prefix}pre_chat_data`, JSON.stringify(data))
    else localStorage.removeItem(`${this.prefix}pre_chat_data`)
  }

  setCachedMessages(messages) {
    try {
      // Guardar solo los últimos 50
      const last50 = messages.slice(-50)
      localStorage.setItem(`${this.prefix}messages`, JSON.stringify(last50))
    } catch {
      // localStorage lleno — ignorar
    }
  }
}
