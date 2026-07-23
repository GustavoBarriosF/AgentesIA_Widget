/**
 * message-input.js — Área de entrada con textarea, adjuntos y envío.
 */

export class MessageInput {
  constructor({ onSend, onAttach }) {
    this.onSend = onSend
    this.onAttach = onAttach
    this.el = this._build()
    this._fileInput = this.el.querySelector('.tw-file-input')
    this._textarea = this.el.querySelector('textarea')
    this._sendBtn = this.el.querySelector('.tw-send-btn')
  }

  _build() {
    const el = document.createElement('div')
    el.className = 'tw-footer'
    el.innerHTML = `
      <div class="tw-input-row">
        <button class="tw-icon-btn tw-attach-btn" type="button" title="Adjuntar archivo" aria-label="Adjuntar archivo">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
          </svg>
        </button>
        <textarea
          class="tw-textarea"
          placeholder="Escribe un mensaje…"
          rows="1"
          maxlength="2000"
          aria-label="Mensaje"
        ></textarea>
        <button class="tw-send-btn tw-icon-btn" type="button" title="Enviar" aria-label="Enviar mensaje" disabled>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
        <input type="file" class="tw-file-input" accept="image/*,.pdf,.doc,.docx" hidden />
      </div>
    `

    const textarea = el.querySelector('textarea')
    const sendBtn = el.querySelector('.tw-send-btn')
    const attachBtn = el.querySelector('.tw-attach-btn')
    const fileInput = el.querySelector('.tw-file-input')

    // Auto-resize textarea
    textarea.addEventListener('input', () => {
      textarea.style.height = 'auto'
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px'
      sendBtn.disabled = !textarea.value.trim()
    })

    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        this._doSend()
      }
    })

    sendBtn.addEventListener('click', () => this._doSend())

    attachBtn.addEventListener('click', () => fileInput.click())

    fileInput.addEventListener('change', () => {
      const file = fileInput.files?.[0]
      if (file) {
        this.onAttach?.(file)
        fileInput.value = ''
      }
    })

    return el
  }

  _doSend() {
    const text = this._textarea.value.trim()
    if (!text) return
    this.onSend?.(text)
    this._textarea.value = ''
    this._textarea.style.height = 'auto'
    this._sendBtn.disabled = true
  }

  setPlaceholder(text) {
    this._textarea.placeholder = text
  }

  focus() { this._textarea.focus() }

  setDisabled(disabled) {
    this._textarea.disabled = disabled
    this._sendBtn.disabled = disabled
    this.el.querySelector('.tw-attach-btn').disabled = disabled
  }
}
