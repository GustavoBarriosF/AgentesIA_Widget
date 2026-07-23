/**
 * typing-indicator.js — Indicador de "agente está escribiendo…"
 */

export class TypingIndicator {
  constructor() {
    this.el = this._build()
  }

  _build() {
    const el = document.createElement('div')
    el.className = 'tw-message tw-message--bot tw-typing-wrap'
    el.hidden = true
    el.innerHTML = `
      <div class="tw-avatar tw-avatar--sm">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      </div>
      <div class="tw-bubble tw-bubble--bot">
        <span class="tw-dot"></span>
        <span class="tw-dot"></span>
        <span class="tw-dot"></span>
      </div>
    `
    return el
  }

  show() { this.el.hidden = false }
  hide() { this.el.hidden = true }
}
