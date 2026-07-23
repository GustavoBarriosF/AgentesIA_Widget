/**
 * message-list.js — Contenedor scrollable de mensajes.
 */
import { createMessageBubble } from './message-bubble.js'
import { TypingIndicator } from './typing-indicator.js'
import { formatRelativeTime } from '../utils/format.js'

export class MessageList {
  constructor(onQuickReply) {
    this.onQuickReply = onQuickReply
    this.typing = new TypingIndicator()
    this.el = this._build()
    this._messages = []
  }

  _build() {
    const el = document.createElement('div')
    el.className = 'tw-messages'
    el.setAttribute('role', 'log')
    el.setAttribute('aria-live', 'polite')
    el.appendChild(this.typing.el)
    el.addEventListener('click', (e) => {
      const btn = e.target.closest('.tw-qr-btn')
      if (btn) {
        const idx = parseInt(btn.dataset.idx, 10)
        const msgWrap = btn.closest('.tw-message')
        if (msgWrap) {
          const msgId = msgWrap.dataset.id
          const msg = this._messages.find(m => m._id === msgId)
          if (msg?.quickReplies?.[idx]) {
            this.onQuickReply?.(msg.quickReplies[idx])
          }
        }
      }
    })
    return el
  }

  setMessages(messages) {
    const safe = Array.isArray(messages) ? messages : []
    // Conservar mensajes pendientes solo si no estamos limpiando todo (reset de conversación)
    const pending = safe.length > 0 ? this._messages.filter(m => m._pending) : []
    // Limpiar mensajes normales y mensajes de sistema (tw-system-msg)
    this.el.querySelectorAll('.tw-message:not(.tw-typing-wrap), .tw-system-msg')
      .forEach(n => n.remove())
    this._messages = []
    for (const msg of safe) {
      this._appendMessage(msg)
    }
    // Re-añadir los pendientes que aún no están confirmados en servidor
    for (const msg of pending) {
      if (!safe.find(m => m._id === msg._id)) {
        this._appendMessage(msg)
      }
    }
    this.typing.hide()
    this.scrollToBottom()
  }

  addMessage(msg) {
    this._appendMessage(msg)
    this.scrollToBottom()
  }

  updateMessage(tempId, confirmedMsg) {
    const el = this.el.querySelector(`[data-id="${tempId}"]`)
    if (el) {
      el.classList.remove('tw-message--pending')
      el.dataset.id = confirmedMsg?._id || tempId
      const statusEl = el.querySelector('.tw-status--pending')
      if (statusEl) statusEl.className = 'tw-status tw-status--sent'
    }
    const idx = this._messages.findIndex(m => m._id === tempId)
    if (idx >= 0 && confirmedMsg) this._messages[idx] = confirmedMsg
  }

  removeMessage(tempId) {
    const el = this.el.querySelector(`[data-id="${tempId}"]`)
    if (el) el.remove()
    this._messages = this._messages.filter(m => m._id !== tempId)
  }

  hideQuickReplies() {
    // Hide quick replies of the last bot message
    const all = this.el.querySelectorAll('.tw-quick-replies')
    all.forEach(qr => qr.style.display = 'none')
  }

  showTyping() { 
    this.typing.show()
    this.scrollToBottom()
  }
  
  hideTyping() { this.typing.hide() }

  refreshTimestamps() {
    const els = this.el.querySelectorAll('.tw-time[data-timestamp]')
    for (const el of els) {
      el.textContent = formatRelativeTime(el.dataset.timestamp)
    }
  }

  /** Muestra un mensaje de sistema (aviso, cierre, etc.) sin agregarlo al historial */
  addSystemMessage(text) {
    const el = document.createElement('div')
    el.className = 'tw-system-msg'
    el.textContent = text
    this.el.insertBefore(el, this.typing.el)
    this.scrollToBottom()
  }

  scrollToBottom(smooth = true) {
    this.el.scrollTo({ top: this.el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
  }

  _appendMessage(msg) {
    const normalized = this._normalizeMsg(msg)
    const bubble = createMessageBubble(normalized)
    this.el.insertBefore(bubble, this.typing.el)
    this._messages.push(normalized)
  }

  // Normaliza quick_replies del backend (ai_meta.quick_replies: string[])
  // al formato interno del widget (quickReplies: {label}[])
  _normalizeMsg(msg) {
    if (!msg.quickReplies && msg.ai_meta?.quick_replies?.length) {
      return {
        ...msg,
        quickReplies: msg.ai_meta.quick_replies.map(qr =>
          typeof qr === 'string' ? { label: qr } : qr
        ),
      }
    }
    return msg
  }
}
