/**
 * launcher-button.js — Botón flotante de apertura del widget.
 */

export class LauncherButton {
  constructor(onClick) {
    this.onClick = onClick
    this.el = this._build()
    this._badge = this.el.querySelector('.tw-badge')
    this._iconChat = this.el.querySelector('.tw-icon-chat')
    this._iconClose = this.el.querySelector('.tw-icon-close')
  }

  _build() {
    const el = document.createElement('button')
    el.className = 'tw-launcher'
    el.setAttribute('type', 'button')
    el.setAttribute('aria-label', 'Abrir chat')
    el.innerHTML = `
      <span class="tw-icon-chat">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      </span>
      <span class="tw-icon-close" hidden>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </span>
      <span class="tw-badge" hidden>0</span>
    `
    el.addEventListener('click', () => this.onClick?.())
    return el
  }

  setOpen(isOpen) {
    this._iconChat.hidden = isOpen
    this._iconClose.hidden = !isOpen
    this.el.setAttribute('aria-expanded', String(isOpen))
    if (isOpen) this.el.classList.add('tw-launcher--open')
    else this.el.classList.remove('tw-launcher--open')
  }

  setUnreadCount(n) {
    if (n > 0) {
      this._badge.hidden = false
      this._badge.textContent = n > 99 ? '99+' : String(n)
    } else {
      this._badge.hidden = true
    }
  }

  setColor(color) {
    this.el.style.setProperty('--tw-color-primary', color)
    this.el.style.setProperty('background', color)
  }

  setLogo(url) {
    if (!url) return
    this._iconChat.innerHTML = `<img src="${url}" alt="logo" class="tw-launcher-logo" />`
  }
}
