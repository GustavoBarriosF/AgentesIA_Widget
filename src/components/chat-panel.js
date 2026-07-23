/**
 * chat-panel.js — Panel principal del chat (header + mensajes + input).
 * Tiene dos vistas: home (sin conversación) y chat (con conversación activa).
 */
import { MessageList } from "./message-list.js";
import { MessageInput } from "./message-input.js";

export class ChatPanel {
  constructor({
    onSend,
    onAttach,
    onClose,
    onQuickReply,
    onStartChat,
    onSurveySubmit,
    onSurveySkip,
    onPreChatSubmit,
    onPreChatSkip,
  }) {
    this.onSend = onSend;
    this.onAttach = onAttach;
    this.onClose = onClose;
    this.onStartChat = onStartChat;
    this.onSurveySubmit = onSurveySubmit;
    this.onSurveySkip = onSurveySkip;
    this.onPreChatSubmit = onPreChatSubmit;
    this.onPreChatSkip = onPreChatSkip;
    this.messageList = new MessageList(onQuickReply);
    this.input = new MessageInput({ onSend, onAttach });
    this.el = this._build();
  }

  _build() {
    const el = document.createElement("div");
    el.className = "tw-panel";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-label", "Chat de soporte");
    el.hidden = true;

    // Header
    const header = document.createElement("div");
    header.className = "tw-header";
    header.innerHTML = `
      <div class="tw-header-left">
        <div class="tw-avatar tw-avatar--lg tw-header-avatar">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </div>
        <div class="tw-header-info">
          <div class="tw-header-name">Soporte</div>
          <div class="tw-header-status">
            <span class="tw-status-dot"></span>
            <span class="tw-status-text">En línea</span>
          </div>
        </div>
      </div>
      <div class="tw-header-right">
        <button class="tw-icon-btn tw-close-btn" type="button" aria-label="Cerrar chat">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    `;
    header
      .querySelector(".tw-close-btn")
      .addEventListener("click", () => this.onClose?.());
    this._header = header;

    // Home screen
    const home = document.createElement("div");
    home.className = "tw-home";
    home.innerHTML = `
      <div class="tw-home-hero">
        <div class="tw-home-hero-nav">
          <div class="tw-home-hero-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <button class="tw-home-menu-btn" type="button" aria-label="Cerrar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/>
            </svg>
          </button>
        </div>
        <h2 class="tw-home-greeting">Hola, ¿qué tal? 👋</h2>
        <p class="tw-home-subtitle">Bienvenido a nuestro sitio web. Pídanos cualquier cosa</p>
      </div>

      <div class="tw-home-content">
        <div class="tw-home-chat-card" role="button" tabindex="0">
          <div class="tw-home-chat-info">
            <p class="tw-home-chat-title">Chatea con nosotros</p>
            <p class="tw-home-chat-time">Normalmente, contestamos en pocos minutos.</p>
          </div>
          <button class="tw-home-chat-arrow" type="button" aria-label="Iniciar chat">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
            </svg>
          </button>
        </div>
      </div>

      <div class="tw-home-bottom">
        <div class="tw-home-tabs">
          <button class="tw-home-tab tw-home-tab--active" type="button">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            <span>Inicio</span>
          </button>
          <button class="tw-home-tab tw-home-tab--to-chat" type="button">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <span>Chat</span>
          </button>
        </div>
        <div class="tw-powered-by">
          POWERED BY <span><a href="https://orbivex.net" target="_blank">ORBIVEX</a></span>
        </div>
      </div>
    `;
    const startChat = () => {
      this.showChat();
      this.onStartChat?.();
    };
    home
      .querySelector(".tw-home-chat-card")
      .addEventListener("click", startChat);
    home.querySelector(".tw-home-chat-arrow").addEventListener("click", (e) => {
      e.stopPropagation();
      startChat();
    });
    home
      .querySelector(".tw-home-tab--to-chat")
      .addEventListener("click", startChat);
    home
      .querySelector(".tw-home-menu-btn")
      .addEventListener("click", () => this.onClose?.());
    this._home = home;

    // Survey screen
    const survey = document.createElement("div");
    survey.className = "tw-survey";
    survey.hidden = true;
    survey.innerHTML = `
      <div class="tw-survey-body">
        <p class="tw-survey-title">¿Cómo calificarías la atención recibida?</p>
        <div class="tw-survey-stars">
          ${[1, 2, 3, 4, 5].map((i) => `<button class="tw-star-btn" data-score="${i}" type="button" aria-label="${i} estrella${i > 1 ? "s" : ""}">★</button>`).join("")}
        </div>
        <textarea class="tw-survey-comment" placeholder="Comentario opcional..." rows="3" maxlength="500"></textarea>
        <div class="tw-survey-actions">
          <button class="tw-survey-skip" type="button">Omitir</button>
          <button class="tw-survey-submit" type="button" disabled>Enviar</button>
        </div>
      </div>
    `;
    this._survey = survey;
    this._surveyScore = 0;

    survey.querySelectorAll(".tw-star-btn").forEach((btn) => {
      btn.addEventListener("mouseenter", () =>
        this._highlightStars(+btn.dataset.score),
      );
      btn.addEventListener("mouseleave", () =>
        this._highlightStars(this._surveyScore),
      );
      btn.addEventListener("click", () => {
        this._surveyScore = +btn.dataset.score;
        this._highlightStars(this._surveyScore);
        survey.querySelector(".tw-survey-submit").disabled = false;
      });
    });
    survey.querySelector(".tw-survey-submit").addEventListener("click", () => {
      const comment = survey.querySelector(".tw-survey-comment").value.trim();
      this.onSurveySubmit?.({
        score: this._surveyScore,
        comment: comment || null,
      });
    });
    survey.querySelector(".tw-survey-skip").addEventListener("click", () => {
      this.onSurveySkip?.();
    });

    // Pre-chat form screen
    const preChatForm = document.createElement("div");
    preChatForm.className = "tw-pre-chat";
    preChatForm.hidden = true;
    preChatForm.innerHTML = `
      <div class="tw-pre-chat-hero">
        <div>
          <p class="tw-pre-chat-hero-label">Antes de continuar</p>
          <h3 class="tw-pre-chat-hero-title">¿Cómo podemos llamarte?</h3>
        </div>
        <button class="tw-icon-btn tw-close-btn-pcf" type="button" aria-label="Cerrar">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <div class="tw-pre-chat-body">
        <div class="tw-pre-chat-card">
          <p class="tw-pcf-desc">Completa estos datos para que podamos ayudarte mejor.</p>
          <div class="tw-pcf-field tw-pcf-phone">
            <label class="tw-pcf-label">Teléfono</label>
            <input class="tw-pcf-input" type="tel" placeholder="+57 300 000 0000" autocomplete="tel" />
          </div>
          <div class="tw-pcf-field tw-pcf-email">
            <label class="tw-pcf-label">Correo electrónico</label>
            <input class="tw-pcf-input" type="email" placeholder="tu@correo.com" autocomplete="email" />
          </div>
          <div class="tw-pcf-field tw-pcf-identification">
            <label class="tw-pcf-label">Identificación / N° de cliente</label>
            <input class="tw-pcf-input" type="text" placeholder="Cédula, NIT o número de cliente" />
          </div>
          <button class="tw-pcf-submit" type="button">Continuar al chat</button>
          <button class="tw-pcf-skip" type="button">Omitir por ahora</button>
        </div>
      </div>
    `;
    preChatForm.querySelector(".tw-close-btn-pcf").addEventListener("click", () => this.onClose?.());
    preChatForm.querySelector(".tw-pcf-submit").addEventListener("click", () => {
      const phone          = preChatForm.querySelector(".tw-pcf-phone input")?.value.trim() || null;
      const email          = preChatForm.querySelector(".tw-pcf-email input")?.value.trim() || null;
      const identification = preChatForm.querySelector(".tw-pcf-identification input")?.value.trim() || null;
      this.onPreChatSubmit?.({ phone, email, identification });
    });
    preChatForm.querySelector(".tw-pcf-skip").addEventListener("click", () => this.onPreChatSkip?.());
    this._preChatForm = preChatForm;

    el.appendChild(header);
    el.appendChild(home);
    el.appendChild(preChatForm);
    el.appendChild(this.messageList.el);
    el.appendChild(this.input.el);
    el.appendChild(survey);
    return el;
  }

  _highlightStars(upTo) {
    this._survey.querySelectorAll(".tw-star-btn").forEach((btn, i) => {
      btn.classList.toggle("tw-star-btn--active", i < upTo);
    });
  }

  /** Muestra la pantalla de inicio (sin conversación activa) */
  showHome() {
    this._header.hidden = true;
    this._home.hidden = false;
    this._preChatForm.hidden = true;
    this.messageList.el.hidden = true;
    this.input.el.hidden = true;
    this._survey.hidden = true;
  }

  /** Muestra la vista de chat (conversación activa) */
  showChat() {
    this._header.hidden = false;
    this._home.hidden = true;
    this._preChatForm.hidden = true;
    this.messageList.el.hidden = false;
    this.input.el.hidden = false;
    this._survey.hidden = true;
    setTimeout(() => this.input.focus(), 80);
  }

  /** Muestra la pantalla de encuesta CSAT */
  showSurvey() {
    this._header.hidden = false;
    this._home.hidden = true;
    this._preChatForm.hidden = true;
    this.messageList.el.hidden = true;
    this.input.el.hidden = true;
    this._survey.hidden = false;
    this._surveyScore = 0;
    this._highlightStars(0);
    this._survey.querySelector(".tw-survey-comment").value = "";
    this._survey.querySelector(".tw-survey-submit").disabled = true;
  }

  /** Muestra el formulario pre-chat para recopilar datos del visitante */
  showPreChatForm({ collectPhone, collectEmail, collectIdentification }) {
    const phoneRow = this._preChatForm.querySelector(".tw-pcf-phone");
    const emailRow = this._preChatForm.querySelector(".tw-pcf-email");
    const idRow    = this._preChatForm.querySelector(".tw-pcf-identification");
    if (phoneRow) phoneRow.hidden = !collectPhone;
    if (emailRow) emailRow.hidden = !collectEmail;
    if (idRow)    idRow.hidden    = !collectIdentification;
    // Limpiar campos
    this._preChatForm.querySelectorAll(".tw-pcf-input").forEach((i) => (i.value = ""));
    this._header.hidden = true;
    this._home.hidden = true;
    this._preChatForm.hidden = false;
    this.messageList.el.hidden = true;
    this.input.el.hidden = true;
    this._survey.hidden = true;
  }

  setConfig(config) {
    this._brandName = config.bot_name || config.workspace_name || "Soporte";

    const nameEl = this.el.querySelector(".tw-header-name");
    if (nameEl) nameEl.textContent = this._brandName;

    if (config.welcome_message) {
      const subtitle = this._home.querySelector(".tw-home-subtitle");
      if (subtitle) subtitle.textContent = config.welcome_message;
    }

    const avatar = this.el.querySelector(".tw-header-avatar");
    if (avatar && config.logo_url) {
      avatar.innerHTML = `<img src="${config.logo_url}" alt="logo" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`;
    }

    const heroIcon = this._home.querySelector(".tw-home-hero-icon");
    if (heroIcon && config.logo_url) {
      heroIcon.innerHTML = `<img src="${config.logo_url}" alt="logo" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`;
    }

    this.input.setPlaceholder(config.placeholder || "Escribe un mensaje…");
  }

  /** Actualiza el nombre en el header durante una conversación activa */
  setHeaderSender(name) {
    const nameEl = this.el.querySelector(".tw-header-name");
    if (nameEl) nameEl.textContent = name || this._brandName || "Soporte";
  }

  // Kept for compatibility but no longer used as a floating bubble
  setWelcomeMessage() {}

  show(animate = true) {
    this.el.hidden = false;
    if (animate) {
      requestAnimationFrame(() => this.el.classList.add("tw-panel--visible"));
    } else {
      this.el.classList.add("tw-panel--visible");
    }
    // Focus is handled by showChat(), not here
  }

  hide() {
    this.el.classList.remove("tw-panel--visible");
    const onEnd = () => {
      this.el.hidden = true;
      this.el.removeEventListener("transitionend", onEnd);
    };
    this.el.addEventListener("transitionend", onEnd);
  }

  setConnecting(isConnecting) {
    const statusText = this.el.querySelector(".tw-status-text");
    const statusDot = this.el.querySelector(".tw-status-dot");
    if (isConnecting) {
      if (statusText) statusText.textContent = "Conectando…";
      if (statusDot) statusDot.classList.add("tw-status-dot--connecting");
    } else {
      if (statusText) statusText.textContent = "En línea";
      if (statusDot) statusDot.classList.remove("tw-status-dot--connecting");
    }
  }

  setError(msg) {
    const existing = this.el.querySelector(".tw-connection-error");
    if (existing) {
      existing.textContent = msg;
      return;
    }
    const bar = document.createElement("div");
    bar.className = "tw-connection-error";
    bar.textContent = msg;
    const header = this.el.querySelector(".tw-header");
    header.insertAdjacentElement("afterend", bar);
  }

  clearError() {
    this.el.querySelector(".tw-connection-error")?.remove();
  }

  get messages() {
    return this.messageList;
  }
}
