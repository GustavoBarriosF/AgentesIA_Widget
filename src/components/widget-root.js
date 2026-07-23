/**
 * widget-root.js — Custom Element raíz <chat-platform-widget>
 * Shadow DOM con CSS aislado. Coordina Core + todos los sub-componentes.
 */
import { Core, STATE } from '../core.js'
import { LauncherButton } from './launcher-button.js'
import { ChatPanel } from './chat-panel.js'

const WIDGET_CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  [hidden] { display: none !important; }

  :host {
    --color-primary: #4F46E5;
    --color-primary-dark: #4338CA;
    --color-bg: #ffffff;
    --color-bg2: #F9FAFB;
    --color-border: #E5E7EB;
    --color-text: #111827;
    --color-muted: #6B7280;
    --color-inverse: #ffffff;
    --color-bubble-v: var(--color-primary);
    --color-bubble-v-text: #ffffff;
    --color-bubble-b: #F3F4F6;
    --color-bubble-b-text: #111827;
    --radius: 18px;
    --radius-sm: 10px;
    --shadow: 0 20px 60px rgba(0,0,0,0.18), 0 4px 16px rgba(0,0,0,0.08);
    --shadow-btn: 0 4px 20px rgba(0,0,0,0.25);
    --font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    --panel-w: 380px;
    --panel-h: 580px;
    --btn-size: 60px;
    --z: 2147483647;
    display: contents;
  }

  :host([dark]) {
    --color-bg: #1F2937;
    --color-bg2: #111827;
    --color-border: #374151;
    --color-text: #F9FAFB;
    --color-muted: #9CA3AF;
    --color-bubble-b: #374151;
    --color-bubble-b-text: #F9FAFB;
  }

  .tw-host {
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: var(--z);
    font-family: var(--font);
    font-size: 14px;
    line-height: 1.5;
  }

  :host([position="left"]) .tw-host { right: auto; left: 20px; }

  .tw-launcher {
    width: var(--btn-size);
    height: var(--btn-size);
    border-radius: 50%;
    background: var(--color-primary);
    border: none;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    box-shadow: var(--shadow-btn);
    transition: transform 0.2s ease, box-shadow 0.2s ease;
    position: relative;
    outline: none;
  }
  .tw-launcher:hover { transform: scale(1.08); }
  .tw-launcher:active { transform: scale(0.96); }

  .tw-launcher-logo { width: 36px; height: 36px; border-radius: 50%; object-fit: cover; }

  .tw-badge {
    position: absolute;
    top: -4px; right: -4px;
    min-width: 20px; height: 20px;
    padding: 0 5px;
    background: #EF4444;
    color: white;
    border-radius: 10px;
    font-size: 11px; font-weight: 700;
    display: flex; align-items: center; justify-content: center;
    border: 2px solid white;
    animation: badgePulse 2s infinite;
  }

  .tw-panel {
    position: absolute;
    bottom: calc(var(--btn-size) + 12px);
    right: 0;
    width: var(--panel-w);
    height: var(--panel-h);
    background: var(--color-bg);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    transform-origin: bottom right;
    opacity: 0;
    transform: scale(0.92) translateY(12px);
    transition: opacity 0.22s ease, transform 0.22s ease;
    pointer-events: none;
  }

  :host([position="left"]) .tw-panel { right: auto; left: 0; transform-origin: bottom left; }

  .tw-panel--visible { opacity: 1; transform: scale(1) translateY(0); pointer-events: all; }

  .tw-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 16px;
    background: var(--color-primary);
    color: white;
    flex-shrink: 0;
  }

  .tw-header-left { display: flex; align-items: center; gap: 10px; }
  .tw-header-right { display: flex; align-items: center; gap: 4px; }
  .tw-header-name { font-weight: 600; font-size: 15px; }
  .tw-header-status { display: flex; align-items: center; gap: 5px; font-size: 12px; opacity: 0.85; margin-top: 2px; }

  .tw-status-dot { width: 7px; height: 7px; border-radius: 50%; background: #4ADE80; display: inline-block; flex-shrink: 0; }
  .tw-status-dot--connecting { background: #FCD34D; animation: spin 1s linear infinite; }

  .tw-avatar {
    border-radius: 50%;
    background: rgba(255,255,255,0.25);
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; overflow: hidden;
  }
  .tw-avatar--lg { width: 40px; height: 40px; }
  .tw-avatar--sm { width: 28px; height: 28px; }
  .tw-message--bot .tw-avatar--sm { background: var(--color-primary); color: white; align-self: flex-end; }

  .tw-messages {
    flex: 1; overflow-y: auto;
    padding: 16px 12px;
    display: flex; flex-direction: column; gap: 10px;
    scroll-behavior: smooth;
    background: var(--color-bg);
  }
  .tw-messages::-webkit-scrollbar { width: 4px; }
  .tw-messages::-webkit-scrollbar-track { background: transparent; }
  .tw-messages::-webkit-scrollbar-thumb { background: var(--color-border); border-radius: 4px; }

  .tw-welcome { display: flex; flex-direction: column; gap: 6px; }
  .tw-welcome-bubble { display: flex; align-items: flex-end; gap: 6px; }

  .tw-home {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: var(--color-bg);
    overflow: hidden;
  }

  .tw-home-hero {
    background: var(--color-primary);
    padding: 18px 20px 48px;
    min-height: 220px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    color: white;
    flex-shrink: 0;
  }
  .tw-home-hero-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .tw-home-hero-icon {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: rgba(255,255,255,0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    overflow: hidden;
    flex-shrink: 0;
  }
  .tw-home-menu-btn {
    background: none;
    border: none;
    cursor: pointer;
    color: rgba(255,255,255,0.85);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 4px;
    border-radius: 6px;
    transition: background 0.15s;
  }
  .tw-home-menu-btn:hover { background: rgba(255,255,255,0.15); }
  .tw-home-greeting {
    font-size: 22px;
    font-weight: 700;
    color: white;
    line-height: 1.3;
    margin: 6px 0 0;
  }
  .tw-home-subtitle {
    font-size: 14px;
    color: rgba(255,255,255,0.85);
    line-height: 1.5;
    margin: 0;
  }

  .tw-home-content {
    flex: 1;
    padding: 0 16px 16px;
    margin-top: -20px;
  }
  .tw-home-chat-card {
    background: var(--color-bg);
    border-radius: 14px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.12);
    padding: 16px;
    display: flex;
    align-items: center;
    gap: 12px;
    cursor: pointer;
    transition: box-shadow 0.2s;
    border: 1px solid var(--color-border);
  }
  .tw-home-chat-card:hover { box-shadow: 0 6px 24px rgba(0,0,0,0.16); }
  .tw-home-chat-info { flex: 1; }
  .tw-home-chat-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--color-text);
    margin: 0 0 4px;
  }
  .tw-home-chat-time {
    font-size: 12px;
    color: var(--color-primary);
    margin: 0;
  }
  .tw-home-chat-arrow {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    background: var(--color-primary);
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    cursor: pointer;
    flex-shrink: 0;
    transition: background 0.15s;
  }
  .tw-home-chat-arrow:hover { background: var(--color-primary-dark); }

  .tw-home-bottom { flex-shrink: 0; }
  .tw-home-tabs {
    display: flex;
    border-top: 1px solid var(--color-border);
  }
  .tw-home-tab {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 3px;
    padding: 10px 0;
    border: none;
    background: transparent;
    cursor: pointer;
    font-size: 11px;
    font-family: var(--font);
    color: var(--color-muted);
    transition: color 0.15s;
  }
  .tw-home-tab--active { color: var(--color-primary); font-weight: 600; }
  .tw-home-tab:hover { color: var(--color-primary); }

  .tw-powered-by {
    text-align: center;
    font-size: 10px;
    color: var(--color-muted);
    padding: 5px 0 10px;
    letter-spacing: 0.04em;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
  }
  .tw-powered-by span {
    font-weight: 700;
    color: var(--color-text);
    letter-spacing: 0.06em;
  }

  .tw-message { display: flex; align-items: flex-end; gap: 6px; animation: fadeIn 0.2s ease; max-width: 100%; }
  .tw-message--visitor { flex-direction: row-reverse; }
  .tw-message--pending .tw-bubble { opacity: 0.7; }

  .tw-bubble-wrap { display: flex; flex-direction: column; gap: 3px; max-width: calc(var(--panel-w) - 80px); }
  .tw-message--visitor .tw-bubble-wrap { align-items: flex-end; }

  .tw-bubble { padding: 9px 13px; border-radius: 16px; font-size: 14px; line-height: 1.5; word-break: break-word; white-space: pre-wrap; }
  .tw-bubble--visitor { background: var(--color-bubble-v); color: var(--color-bubble-v-text); border-bottom-right-radius: 4px; }
  .tw-bubble--bot { background: var(--color-bubble-b); color: var(--color-bubble-b-text); border-bottom-left-radius: 4px; }

  .tw-message-meta { font-size: 10px; color: var(--color-muted); display: flex; align-items: center; gap: 4px; }

  .tw-quick-replies { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
  .tw-qr-btn {
    padding: 6px 12px;
    border: 1.5px solid var(--color-primary);
    border-radius: 20px;
    background: transparent;
    color: var(--color-primary);
    font-size: 13px; cursor: pointer;
    transition: background 0.15s, color 0.15s;
    font-family: var(--font);
  }
  .tw-qr-btn:hover { background: var(--color-primary); color: white; }

  .tw-status { display: flex; align-items: center; }
  .tw-status--sent { color: var(--color-muted); }
  .tw-status--pending { color: var(--color-muted); opacity: 0.6; }

  .tw-typing-wrap .tw-bubble--bot { display: flex; align-items: center; gap: 4px; padding: 12px 16px; }
  .tw-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--color-muted); display: inline-block; animation: dots 1.2s infinite; }
  .tw-dot:nth-child(2) { animation-delay: 0.2s; }
  .tw-dot:nth-child(3) { animation-delay: 0.4s; }

  .tw-msg-image { max-width: 200px; max-height: 200px; border-radius: 12px; display: block; cursor: pointer; }
  .tw-msg-file { display: flex; align-items: center; gap: 8px; color: inherit; text-decoration: none; padding: 4px 0; }
  .tw-msg-file:hover { text-decoration: underline; }
  .tw-link { color: inherit; text-decoration: underline; }
  .tw-bubble--visitor .tw-link { color: rgba(255,255,255,0.9); }

  .tw-footer { border-top: 1px solid var(--color-border); padding: 10px 12px; background: var(--color-bg); flex-shrink: 0; }

  /* ── Survey CSAT ── */
  .tw-survey { flex: 1; display: flex; align-items: center; justify-content: center; padding: 24px 20px; overflow-y: auto; }
  [hidden].tw-survey { display: none !important; }
  .tw-survey-body { width: 100%; display: flex; flex-direction: column; gap: 16px; }
  .tw-survey-title { font-size: 15px; font-weight: 600; color: var(--color-text); text-align: center; line-height: 1.4; }
  .tw-survey-stars { display: flex; justify-content: center; gap: 8px; }
  .tw-star-btn { font-size: 32px; background: none; border: none; cursor: pointer; color: var(--color-border); transition: color 0.15s, transform 0.1s; line-height: 1; padding: 2px; }
  .tw-star-btn:hover, .tw-star-btn--active { color: #f59e0b; transform: scale(1.15); }
  .tw-survey-comment { width: 100%; padding: 10px 12px; border: 1.5px solid var(--color-border); border-radius: 12px; background: var(--color-bg2); color: var(--color-text); font-size: 13px; font-family: var(--font); resize: none; outline: none; transition: border-color 0.2s; box-sizing: border-box; }
  .tw-survey-comment:focus { border-color: var(--color-primary); }
  .tw-survey-actions { display: flex; gap: 10px; justify-content: flex-end; }
  .tw-survey-skip { background: none; border: 1.5px solid var(--color-border); color: var(--color-muted); padding: 8px 16px; border-radius: 20px; cursor: pointer; font-size: 13px; font-family: var(--font); transition: border-color 0.2s; }
  .tw-survey-skip:hover { border-color: var(--color-muted); }
  .tw-survey-submit { background: var(--color-primary); color: white; border: none; padding: 8px 20px; border-radius: 20px; cursor: pointer; font-size: 13px; font-weight: 600; font-family: var(--font); transition: opacity 0.2s; }
  .tw-survey-submit:disabled { opacity: 0.4; cursor: default; }
  .tw-survey-submit:not(:disabled):hover { opacity: 0.85; }
  .tw-input-row {
    display: flex; align-items: flex-end; gap: 6px;
    background: var(--color-bg2);
    border: 1.5px solid var(--color-border);
    border-radius: 24px; padding: 6px 6px 6px 10px;
    transition: border-color 0.2s;
  }
  .tw-input-row:focus-within { border-color: var(--color-primary); }
  .tw-textarea {
    flex: 1; border: none; background: transparent; resize: none;
    font-size: 14px; font-family: var(--font); color: var(--color-text);
    outline: none; line-height: 1.5; max-height: 120px; overflow-y: auto; padding: 2px 0;
  }
  .tw-textarea::placeholder { color: var(--color-muted); }

  .tw-icon-btn {
    width: 34px; height: 34px; border-radius: 50%;
    border: none; background: transparent; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    color: var(--color-muted);
    transition: background 0.15s, color 0.15s;
    flex-shrink: 0; outline: none;
  }
  .tw-icon-btn:hover:not(:disabled) { background: var(--color-border); color: var(--color-text); }
  .tw-icon-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .tw-send-btn:not(:disabled) { background: var(--color-primary); color: white; }
  .tw-send-btn:not(:disabled):hover { background: var(--color-primary-dark); color: white; }
  .tw-close-btn { color: rgba(255,255,255,0.8); }
  .tw-close-btn:hover { background: rgba(255,255,255,0.15); color: white; }

  .tw-connection-error { background: #FEF2F2; color: #991B1B; font-size: 12px; padding: 8px 16px; text-align: center; flex-shrink: 0; }
  .tw-system-msg { font-size: 11px; color: var(--color-muted); text-align: center; padding: 8px 16px; margin: 4px 0; background: #F8F8F8; border-radius: 8px; }

  @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes dots { 0%, 80%, 100% { opacity: 0.3; transform: scale(0.6); } 40% { opacity: 1; transform: scale(1); } }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes badgePulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.5); } 50% { box-shadow: 0 0 0 6px rgba(239,68,68,0); } }

  /* ── Pre-chat form ── */
  .tw-pre-chat { flex: 1; display: flex; flex-direction: column; background: var(--color-bg); overflow: hidden; }
  .tw-pre-chat-hero {
    background: var(--color-primary);
    padding: 18px 20px 40px;
    color: white;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .tw-pre-chat-hero-label { font-size: 12px; opacity: 0.8; margin-bottom: 4px; }
  .tw-pre-chat-hero-title { font-size: 18px; font-weight: 700; color: white; margin: 0; }
  .tw-pre-chat-body { flex: 1; padding: 0 16px 20px; margin-top: -20px; overflow-y: auto; }
  .tw-pre-chat-card {
    background: var(--color-bg);
    border-radius: 14px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.12);
    padding: 20px;
    border: 1px solid var(--color-border);
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .tw-pcf-desc { font-size: 13px; color: var(--color-muted); margin: 0; }
  .tw-pcf-field { display: flex; flex-direction: column; gap: 5px; }
  .tw-pcf-label { font-size: 11px; font-weight: 600; color: var(--color-muted); text-transform: uppercase; letter-spacing: 0.04em; }
  .tw-pcf-input {
    width: 100%;
    padding: 9px 12px;
    border: 1.5px solid var(--color-border);
    border-radius: 10px;
    background: var(--color-bg2);
    color: var(--color-text);
    font-size: 14px;
    font-family: var(--font);
    outline: none;
    transition: border-color 0.2s;
    box-sizing: border-box;
  }
  .tw-pcf-input:focus { border-color: var(--color-primary); }
  .tw-pcf-submit {
    width: 100%;
    padding: 11px;
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: 10px;
    font-size: 14px;
    font-weight: 600;
    font-family: var(--font);
    cursor: pointer;
    transition: opacity 0.2s;
    margin-top: 4px;
  }
  .tw-pcf-submit:hover { opacity: 0.88; }
  .tw-pcf-skip {
    text-align: center;
    font-size: 12px;
    color: var(--color-muted);
    cursor: pointer;
    padding: 4px;
    text-decoration: underline;
    background: none;
    border: none;
    font-family: var(--font);
    width: 100%;
  }
  .tw-pcf-skip:hover { color: var(--color-text); }

  @media (max-width: 480px) {
    .tw-panel { position: fixed; bottom: 0; right: 0; left: 0; width: 100%; height: 90vh; border-bottom-left-radius: 0; border-bottom-right-radius: 0; transform-origin: bottom center; }
    .tw-host { bottom: 16px; right: 16px; }
  }
`

class ChatPlatformWidget extends HTMLElement {
  constructor() {
    super()
    this._shadow = this.attachShadow({ mode: 'open' })
    this._core = null
    this._launcher = null
    this._panel = null
    this._initialized = false
    this._timeInterval = null
  }

  static get observedAttributes() {
    return ['workspace', 'position', 'color', 'dark']
  }

  connectedCallback() {
    if (!this._initialized) {
      this._render()
      this._initialized = true
    }
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (!this._initialized) return
    if (name === 'color' && newVal) this._applyColor(newVal)
    if (name === 'dark') this._shadow.host.toggleAttribute('dark', newVal !== null)
  }

  disconnectedCallback() {
    clearInterval(this._timeInterval)
    this._timeInterval = null
    this._core?.destroy()
  }

  _render() {
    const style = document.createElement('style')
    style.textContent = WIDGET_CSS

    const host = document.createElement('div')
    host.className = 'tw-host'

    this._launcher = new LauncherButton(() => this._core?.toggle())
    this._panel = new ChatPanel({
      onSend:           (text) => this._core?.sendMessage(text),
      onAttach:         (file) => this._core?.uploadFile(file),
      onClose:          ()     => this._core?.close(),
      onQuickReply:     (qr)   => this._handleQuickReply(qr),
      onStartChat:      ()     => { /* input already focused by showChat() */ },
      onSurveySubmit:   ({ score, comment }) => this._handleSurveySubmit(score, comment),
      onSurveySkip:     ()     => this._handleSurveySkip(),
      onPreChatSubmit:  (data) => this._handlePreChatSubmit(data),
      onPreChatSkip:    ()     => this._handlePreChatSkip(),
    })

    host.appendChild(this._panel.el)
    host.appendChild(this._launcher.el)

    this._shadow.appendChild(style)
    this._shadow.appendChild(host)

    const slug = this.getAttribute('workspace')
    if (!slug) { console.warn('[NexoraChat] falta atributo workspace'); return }

    this._core = new Core(slug)
    this._bindCore()
    this._core.init()
  }

  _bindCore() {
    const c = this._core

    c.on('initialized', ({ config, unreadCount }) => {
      this._applyConfig(config)
      this._launcher.setUnreadCount(unreadCount)
    })

    c.on('opened', () => {
      this._launcher.setOpen(true)
      this._panel.show()
      this._panel.clearError()
      this._panel.messages.hideTyping()
      // Si el formulario pre-chat está activo y no se ha completado aún
      const pcf = c.config?.pre_chat_form
      if (pcf?.enabled && !c.session?.preChatFormDone) {
        this._panel.showPreChatForm({
          collectPhone:          pcf.collect_phone,
          collectEmail:          pcf.collect_email,
          collectIdentification: pcf.collect_identification,
        })
      } else if (c.session?.pendingSurvey) {
        this._panel.showSurvey()
      } else if (c.conversationId && c.messages.length > 0) {
        this._panel.showChat()
      } else {
        this._panel.showHome()
      }
      // Refrescar timestamps mientras el panel está abierto
      clearInterval(this._timeInterval)
      this._timeInterval = setInterval(() => {
        this._panel.messages.refreshTimestamps()
      }, 60000)
    })

    c.on('closed', () => {
      this._launcher.setOpen(false)
      this._panel.hide()
      clearInterval(this._timeInterval)
      this._timeInterval = null
    })

    c.on('state:changed', ({ state }) => {
      const connecting = state === STATE.CONNECTING || state === STATE.RECONNECTING
      this._panel.setConnecting(connecting)
    })

    c.on('messages:loaded', ({ messages }) => {
      this._panel.messages.setMessages(messages)
      if (messages.length > 0) {
        // Restaurar el nombre del último emisor (bot o agente)
        const lastSenderMsg = [...messages].reverse().find(m => m.sender_type === 'bot' || m.sender_type === 'agent')
        if (lastSenderMsg?.sender_type === 'bot' && lastSenderMsg.ai_meta?.bot_name) {
          this._panel.setHeaderSender(lastSenderMsg.ai_meta.bot_name)
        } else if (lastSenderMsg?.sender_type === 'agent' && lastSenderMsg.sender_name) {
          this._panel.setHeaderSender(lastSenderMsg.sender_name)
        }
        this._panel.showChat()
      }
    })

    c.on('message:pending', ({ message }) => {
      this._panel.showChat()
      this._panel.messages.hideQuickReplies()
      this._panel.messages.addMessage(message)
    })

    c.on('message:received', ({ message }) => {
      this._panel.messages.addMessage(message)
      // Actualizar nombre del header según quien habla
      if (message.sender_type === 'bot' && message.ai_meta?.bot_name) {
        this._panel.setHeaderSender(message.ai_meta.bot_name)
      } else if (message.sender_type === 'agent' && message.sender_name) {
        this._panel.setHeaderSender(message.sender_name)
      }
    })

    c.on('message:confirmed', ({ tempId, message }) => {
      this._panel.messages.updateMessage(tempId, message)
    })

    c.on('message:removed', ({ tempId }) => {
      this._panel.messages.removeMessage(tempId)
    })

    c.on('typing:changed', ({ isTyping }) => {
      if (isTyping) this._panel.messages.showTyping()
      else this._panel.messages.hideTyping()
    })

    c.on('unread:changed', ({ count }) => {
      this._launcher.setUnreadCount(count)
    })

    c.on('connection:error', () => {
      this._panel.setError('Sin conexion, reintentando...')
    })

    c.on('connection:restored', () => {
      this._panel.clearError()
    })

    c.on('error', ({ message }) => {
      this._panel.setError(message)
      setTimeout(() => this._panel.clearError(), 4000)
    })

    c.on('conversation:assigned', ({ agent_name }) => {
      if (agent_name) this._panel.setHeaderSender(agent_name)
    })

    let _resolvedHandled = false
    c.on('conversation:resolved', () => {
      if (_resolvedHandled) return
      _resolvedHandled = true
      setTimeout(() => { _resolvedHandled = false }, 5000)
      // Guardar encuesta pendiente en localStorage antes de resetear
      if (c.session && c._resolvedConvId) {
        c.session.pendingSurvey = { conversationId: c._resolvedConvId }
      }
      // Restaurar nombre del branding al resolver
      this._panel.setHeaderSender(null)
      // Limpiar mensajes y mostrar encuesta
      this._panel.messages.setMessages([])
      this._panel.showSurvey()
    })
  }

  _applyConfig(config) {
    // Color legacy (campo raíz) + color del design
    const color = config.design?.primary_color || config.primary_color
    if (color) this._applyColor(color)
    this._applyDesign(config.design)

    // Merge design fields into config for the panel
    const mergedConfig = { ...config }
    if (config.design?.bot_display_name) {
      mergedConfig.bot_name = config.design.bot_display_name
    }
    this._panel.setConfig(mergedConfig)
  }

  _applyColor(color) {
    const host = this._shadow.querySelector('.tw-host')
    if (host) {
      host.style.setProperty('--color-primary', color)
      host.style.setProperty('--color-primary-dark', _darken(color, 10))
      host.style.setProperty('--color-bubble-v', color)
    }
  }

  _applyDesign(design) {
    if (!design) return
    const host = this._shadow.querySelector('.tw-host')

    // Posición — usa el atributo del host para que el CSS :host([position="left"]) aplique
    if (design.position) {
      if (design.position === 'bottom-left') {
        this.setAttribute('position', 'left')
      } else {
        this.removeAttribute('position')
      }
    }

    // Tamaño del launcher
    const sizeMap = { small: '48px', medium: '56px', large: '64px' }
    if (design.launcher_size && sizeMap[design.launcher_size] && host) {
      host.style.setProperty('--btn-size', sizeMap[design.launcher_size])
    }

    // Radio de bordes del panel
    const radiusMap = { none: '0px', small: '4px', medium: '18px', large: '28px' }
    if (design.border_radius && radiusMap[design.border_radius] && host) {
      host.style.setProperty('--radius', radiusMap[design.border_radius])
    }

    // Familia tipográfica
    const fontMap = {
      system:  '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      inter:   '"Inter", sans-serif',
      roboto:  '"Roboto", sans-serif',
      poppins: '"Poppins", sans-serif',
    }
    if (design.font_family && fontMap[design.font_family] && host) {
      host.style.setProperty('--font', fontMap[design.font_family])
    }

    // Color del texto del encabezado
    if (design.text_color && host) {
      host.style.setProperty('--color-inverse', design.text_color)
    }
  }

  _handlePreChatSubmit(data) {
    const c = this._core
    if (!c) return
    c.submitPreChatForm(data)
    if (c.session?.pendingSurvey) {
      this._panel.showSurvey()
    } else if (c.conversationId && c.messages.length > 0) {
      this._panel.showChat()
    } else {
      this._panel.showHome()
    }
  }

  _handlePreChatSkip() {
    this._core?.skipPreChatForm()
    this._panel.showHome()
  }

  async _handleSurveySubmit(score, comment) {
    const pending = this._core?.session?.pendingSurvey
    if (pending?.conversationId) {
      await this._core?.submitSurvey(pending.conversationId, score, comment)
    }
    this._panel.showHome()
  }

  _handleSurveySkip() {
    if (this._core?.session) this._core.session.pendingSurvey = null
    this._panel.showHome()
  }

  _handleQuickReply(qr) {
    this._panel.messages.hideQuickReplies()
    // No añadir el mensaje aquí: sendMessage() emite 'message:pending' que ya lo añade
    this._core?.sendMessage(qr.label)
  }

  widgetOpen()            { this._core?.open() }
  widgetClose()           { this._core?.close() }
  widgetToggle()          { this._core?.toggle() }
  widgetIdentify(data)    { this._core?.identify(data) }
  widgetSendMessage(text) { this._core?.sendMessage(text) }
  widgetOn(event, cb)     { return this._core?.on(event, cb) }
  widgetDestroy()         { this._core?.destroy(); this.remove() }
}

function _darken(hex, amount) {
  try {
    const n = parseInt(hex.replace('#', ''), 16)
    const r = Math.max(0, (n >> 16) - Math.round(amount * 2.55))
    const g = Math.max(0, ((n >> 8) & 0xff) - Math.round(amount * 2.55))
    const b = Math.max(0, (n & 0xff) - Math.round(amount * 2.55))
    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')
  } catch { return hex }
}

if (!customElements.get('chat-platform-widget')) {
  customElements.define('chat-platform-widget', ChatPlatformWidget)
}
