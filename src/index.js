/**
 * index.js — Punto de entrada del widget.
 * Lee el data-workspace del script tag y arranca el widget.
 */

import { Core } from './core.js'
import './components/widget-root.js'
import './components/launcher-button.js'
import './components/chat-panel.js'
import './components/message-list.js'
import './components/message-bubble.js'
import './components/message-input.js'
import './components/typing-indicator.js'

function init(config = {}) {
  const slug = config.workspace || getSlugFromScript()
  if (!slug) {
    console.warn('[NexoraChat] data-workspace no especificado.')
    return
  }

  // Crear el elemento raíz si no existe
  if (!customElements.get('chat-platform-widget')) {
    console.warn('[NexoraChat] Web Components no disponibles en este navegador.')
    return
  }

  let el = document.querySelector('chat-platform-widget')
  if (!el) {
    el = document.createElement('chat-platform-widget')
    // IMPORTANTE: poner atributos ANTES de appendChild
    // para que connectedCallback los vea desde el primer momento
    el.setAttribute('workspace', slug)
    if (config.position) el.setAttribute('position', config.position)
    if (config.color)    el.setAttribute('color', config.color)
    document.body.appendChild(el)
  } else {
    el.setAttribute('workspace', slug)
    if (config.position) el.setAttribute('position', config.position)
    if (config.color)    el.setAttribute('color', config.color)
  }

  // API pública
  window.ChatWidget = {
    open:        ()      => el.widgetOpen(),
    close:       ()      => el.widgetClose(),
    toggle:      ()      => el.widgetToggle(),
    identify:    (data)  => el.widgetIdentify(data),
    sendMessage: (text)  => el.widgetSendMessage(text),
    on:          (e, cb) => el.widgetOn(e, cb),
    destroy:     ()      => el.widgetDestroy(),
    get isOpen() { return el.hasAttribute('open') },
  }

  return window.ChatWidget
}

function getSlugFromScript() {
  const scripts = document.querySelectorAll('script[data-workspace]')
  const current = scripts[scripts.length - 1]
  return current?.getAttribute('data-workspace') || null
}

// Auto-init si hay un script tag con data-workspace
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => init())
} else {
  init()
}

export { init }
export default { init }
