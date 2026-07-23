/**
 * session.js — Identidad persistente del visitante anónimo.
 * Genera o recupera un session_id único por workspace desde localStorage.
 */

const STORAGE_PREFIX = 'trivox_';

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16)
  })
}

class Session {
  constructor(workspaceId) {
    this.workspaceId = workspaceId;
    this.prefix = `${STORAGE_PREFIX}${workspaceId}_`;
    // Si no hay conversación activa, generar un nuevo session_id.
    // Esto garantiza que cada visitante nuevo (misma PC, distinta persona)
    // tenga su propio contacto en lugar de reutilizar el anterior.
    if (!this.conversationId) {
      localStorage.setItem(`${this.prefix}session_id`, generateUUID());
    }
  }

  get sessionId() {
    let id = localStorage.getItem(`${this.prefix}session_id`);
    if (!id) {
      id = generateUUID();
      localStorage.setItem(`${this.prefix}session_id`, id);
    }
    return id
  }

  resetSessionId() {
    const newId = generateUUID();
    localStorage.setItem(`${this.prefix}session_id`, newId);
    return newId
  }

  get conversationId() {
    return localStorage.getItem(`${this.prefix}conv_id`) || null
  }

  set conversationId(id) {
    if (id) localStorage.setItem(`${this.prefix}conv_id`, id);
    else localStorage.removeItem(`${this.prefix}conv_id`);
  }

  get contactId() {
    return localStorage.getItem(`${this.prefix}contact_id`) || null
  }

  set contactId(id) {
    if (id) localStorage.setItem(`${this.prefix}contact_id`, id);
    else localStorage.removeItem(`${this.prefix}contact_id`);
  }

  get isOpen() {
    return localStorage.getItem(`${this.prefix}open`) === '1'
  }

  set isOpen(val) {
    localStorage.setItem(`${this.prefix}open`, val ? '1' : '0');
  }

  get unreadCount() {
    return parseInt(localStorage.getItem(`${this.prefix}unread`) || '0', 10)
  }

  set unreadCount(n) {
    localStorage.setItem(`${this.prefix}unread`, String(n));
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
    if (data) localStorage.setItem(`${this.prefix}pending_survey`, JSON.stringify(data));
    else localStorage.removeItem(`${this.prefix}pending_survey`);
  }

  get preChatFormDone() {
    return localStorage.getItem(`${this.prefix}pre_chat_done`) === '1'
  }

  set preChatFormDone(val) {
    localStorage.setItem(`${this.prefix}pre_chat_done`, val ? '1' : '0');
  }

  get preChatData() {
    try { return JSON.parse(localStorage.getItem(`${this.prefix}pre_chat_data`) || 'null') } catch { return null }
  }

  set preChatData(data) {
    if (data) localStorage.setItem(`${this.prefix}pre_chat_data`, JSON.stringify(data));
    else localStorage.removeItem(`${this.prefix}pre_chat_data`);
  }

  setCachedMessages(messages) {
    try {
      // Guardar solo los últimos 50
      const last50 = messages.slice(-50);
      localStorage.setItem(`${this.prefix}messages`, JSON.stringify(last50));
    } catch {
      // localStorage lleno — ignorar
    }
  }
}

/**
 * api.js — Wrapper sobre fetch para peticiones al backend del widget.
 */

const BACKEND_URL$1 = "http://localhost:4000";

class Api {
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.baseUrl = BACKEND_URL$1;
  }

  async _request(method, path, body, isMultipart = false) {
    const url = `${this.baseUrl}${path}`;
    const headers = { 'x-session-id': this.sessionId };
    if (!isMultipart) headers['Content-Type'] = 'application/json';

    const opts = { method, headers };
    if (body) {
      opts.body = isMultipart ? body : JSON.stringify(body);
    }

    let lastErr;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(url, opts);
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: res.statusText }));
          throw Object.assign(new Error(err.error || res.statusText), { status: res.status })
        }
        return res.status === 204 ? null : res.json()
      } catch (err) {
        lastErr = err;
        if (err.status && err.status < 500) throw err // No reintentar errores del cliente
        if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
    throw lastErr
  }

  get(path) { return this._request('GET', path) }
  post(path, body) { return this._request('POST', path, body) }
  patch(path, body) { return this._request('PATCH', path, body) }

  upload(path, formData) { return this._request('POST', path, formData, true) }

  async getConfig(slug) {
    return this.get(`/widget/config/${slug}`)
  }

  async createConversation({ workspaceId, channelId, metadata = {} }) {
    return this.post('/widget/conversations', {
      workspace_id: workspaceId,
      channel_id:   channelId,
      session_id:   this.sessionId,
      metadata,
    })
  }

  async getMessages(convId, { before, limit = 50 } = {}) {
    const params = new URLSearchParams({ session_id: this.sessionId, limit });
    if (before) params.set('before', before);
    return this.get(`/widget/conversations/${convId}/messages?${params}`)
  }

  async sendMessage(conversationId, content) {
    return this.post('/widget/messages', {
      conversation_id: conversationId,
      session_id:      this.sessionId,
      content,
    })
  }

  async submitSurvey(conversationId, score, comment) {
    return this.post('/widget/survey', {
      conversation_id: conversationId,
      session_id:      this.sessionId,
      score,
      comment: comment || null,
    })
  }

  async uploadFile(conversationId, file, onProgress) {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('conversation_id', conversationId);
    fd.append('session_id', this.sessionId);
    return this.upload('/widget/messages/upload', fd)
  }

  async updateContact(sessionId, workspaceId, data) {
    return this.patch(`/widget/contacts/${sessionId}`, { workspace_id: workspaceId, ...data })
  }

  async markAsRead(conversationId) {
    return this.post('/widget/messages/read', {
      conversation_id: conversationId,
      session_id:      this.sessionId,
    })
  }
}

/**
 * socket.js — Cliente WebSocket usando Socket.IO.
 * La librería se carga dinámicamente solo cuando el visitante abre el chat.
 */

const BACKEND_URL = "http://localhost:4000";
const SOCKET_IO_CDN = `${BACKEND_URL}/socket.io/socket.io.js`;
const WIDGET_NS = `${BACKEND_URL}/widget`;
let _loadPromise = null;

function loadSocketIO() {
  if (_loadPromise) return _loadPromise
  _loadPromise = new Promise((resolve, reject) => {
    if (window.io) return resolve(window.io)
    const script = document.createElement('script');
    script.src = SOCKET_IO_CDN;
    script.onload = () => resolve(window.io);
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return _loadPromise
}

class SocketService {
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.socket = null;
    this.listeners = new Map();
    this.pendingMessages = [];
    this._reconnectAttempts = 0;
  }

  async connect() {
    const io = await loadSocketIO();
    // Conectar al namespace /widget (sin JWT, solo session_id)
    this.socket = io(WIDGET_NS, {
      auth: { session_id: this.sessionId },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 30000,
      reconnectionAttempts: Infinity,
    });

    // Esperar a que la conexión esté establecida antes de resolver
    await new Promise((resolve) => {
      let done = false;
      const finish = () => { if (!done) { done = true; resolve(); } };

      this.socket.once('connect', finish);
      this.socket.once('connect_error', finish); // Resolver igual para no bloquear
      setTimeout(finish, 5000); // Timeout de seguridad
    });

    this.socket.on('connect', () => {
      this._reconnectAttempts = 0;
      this._emit('connection:status', { connected: true });
      // Reenviar mensajes pendientes tras reconexión
      for (const msg of this.pendingMessages) {
        this.socket.emit(msg.event, msg.data);
      }
      this.pendingMessages = [];
    });

    this.socket.on('disconnect', (reason) => {
      this._emit('connection:status', { connected: false, reason });
    });

    this.socket.on('connect_error', (err) => {
      this._reconnectAttempts++;
      this._emit('connection:error', { error: err.message, attempt: this._reconnectAttempts });
    });

    // Eventos del dominio
    const domainEvents = ['new:message', 'typing:start', 'typing:stop',
      'conversation:assigned', 'conversation:resolved', 'conversation:status_changed'];
    for (const event of domainEvents) {
      this.socket.on(event, (data) => this._emit(event, data));
    }
  }

  joinConversation(convId) {
    return new Promise((resolve) => {
      if (!this.socket?.connected) { resolve(); return }
      let done = false;
      const finish = () => { if (!done) { done = true; resolve(); } };
      this.socket.emit('join:conversation', { conversationId: convId }, finish);
      setTimeout(finish, 1500);  // fallback si el servidor no envía ACK
    })
  }

  on(event, handler) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(handler);
    return () => this.listeners.get(event)?.delete(handler)
  }

  _emit(event, data) {
    for (const handler of this.listeners.get(event) ?? []) {
      try { handler(data); } catch {}
    }
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }
}

// Detectores para lead capture (email, phone, name)

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

const PHONE_RE = /(?:\+?\d{1,3}[\s\-.]?)?\(?\d{1,4}\)?[\s\-.]?\d{3,4}[\s\-.]?\d{3,4}/g;

const NAME_TRIGGERS = ['me llamo', 'soy', 'mi nombre es', 'habla', 'te escribe', 'les escribe'];

const DAYS_MONTHS = new Set(['lunes','martes','miércoles','jueves','viernes','sábado','domingo',
  'enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']);

function detectEmail(text) {
  const matches = [...text.matchAll(EMAIL_RE)];
  return matches.length ? matches[0][0] : null
}

function detectPhone(text) {
  const lower = text.toLowerCase();
  const hasContext = /llama|whatsapp|cel|celular|número|telefon|al \+|contacto|movil|móvil/.test(lower);
  const matches = [...text.matchAll(PHONE_RE)];
  if (!matches.length) return null
  const num = matches[0][0].replace(/[\s\-.()]/g, '');
  if (num.length < 7) return null
  // Filtrar años y códigos de 4 dígitos
  if (/^(19|20)\d{2}$/.test(num)) return null
  return hasContext || num.length >= 8 ? matches[0][0] : null
}

function detectName(text) {
  const lower = text.toLowerCase();
  const trigger = NAME_TRIGGERS.find(t => lower.includes(t));
  if (!trigger) return null
  const afterTrigger = lower.indexOf(trigger) + trigger.length;
  const rest = text.slice(afterTrigger).trim();
  const words = rest.split(/\s+/).slice(0, 3);
  const nameWords = words.filter(w => {
    if (w.length < 2) return false
    if (DAYS_MONTHS.has(w.toLowerCase())) return false
    return true
  });
  if (nameWords.length < 1) return null
  // Capitalizar cada palabra del nombre
  return nameWords.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
}

class LeadDetector {
  constructor(onDetected) {
    this.onDetected = onDetected;
    this._detected = { email: false, phone: false, name: false };
  }

  analyze(text) {
    if (!this._detected.email) {
      const email = detectEmail(text);
      if (email) {
        this._detected.email = true;
        this.onDetected({ type: 'email', value: email });
      }
    }
    if (!this._detected.phone) {
      const phone = detectPhone(text);
      if (phone) {
        this._detected.phone = true;
        this.onDetected({ type: 'phone', value: phone });
      }
    }
    if (!this._detected.name) {
      const name = detectName(text);
      if (name) {
        this._detected.name = true;
        this.onDetected({ type: 'name', value: name });
      }
    }
  }

  reset() {
    this._detected = { email: false, phone: false, name: false };
  }
}

let _config = null;

async function loadConfig(slug, sessionId) {
  if (_config) return _config
  const api = new Api(sessionId);
  try {
    _config = await api.getConfig(slug);
    return _config
  } catch (err) {
    throw new Error(`No se pudo cargar la configuración del widget: ${err.message}`)
  }
}

/**
 * core.js — Cerebro del widget. Máquina de estados + coordinador.
 * No renderiza nada. Coordina Session, Api, Socket, LeadDetector.
 */


// Estados posibles del widget
const STATE = {
  UNINITIALIZED: 'UNINITIALIZED',
  LOADING:       'LOADING',
  IDLE:          'IDLE',
  OPEN:          'OPEN',
  CONNECTING:    'CONNECTING',
  RECONNECTING:  'RECONNECTING',
  UPLOADING:     'UPLOADING',
  RECORDING:     'RECORDING',
  ERROR:         'ERROR',
};

class Core {
  constructor(slug) {
    this.slug = slug;
    this.state = STATE.UNINITIALIZED;
    this.config = null;
    this.session = null;
    this.api = null;
    this.socket = null;
    this.leadDetector = null;
    this.listeners = new Map();

    // Estado de la conversación
    this.conversationId = null;
    this.contactId = null;
    this.messages = [];
    this.unreadCount = 0;
    this.isTyping = false;
    this._typingTimeout = null;
    this._pendingOpen = false;  // El usuario quiso abrir mientras init() estaba en progreso
  }

  async init() {
    this._setState(STATE.LOADING);
    try {
      this.config = await loadConfig(this.slug, 'tmp');
      this.session = new Session(this.config.workspace_id);
      this.api = new Api(this.session.sessionId);
      this.config = await this.api.getConfig(this.slug); // Con session_id real

      this.leadDetector = new LeadDetector(({ type, value }) => {
        this._handleLeadDetected(type, value);
      });

      // Restaurar estado de sesión previa
      this.conversationId = this.session.conversationId;
      this.contactId = this.session.contactId;
      this.unreadCount = this.session.unreadCount;
      this.messages = this.session.getCachedMessages();

      this._setState(STATE.IDLE);
      this._emit('initialized', { config: this.config, unreadCount: this.unreadCount });

      // Abrir si: había conversación abierta, O el usuario hizo clic mientras cargaba
      if (this._pendingOpen || (this.session.isOpen && this.conversationId)) {
        this._pendingOpen = false;
        await this.open();
      }
    } catch (err) {
      this._setState(STATE.ERROR);
      this._emit('error', { message: err.message });
    }
  }

  async open() {
    if (this.state === STATE.OPEN) return

    // Si init() falló o no se ejecutó, reintentarlo antes de abrir
    if (this.state === STATE.ERROR || this.state === STATE.UNINITIALIZED) {
      await this.init();
      if (this.state !== STATE.IDLE) return  // Sigue fallando
    }

    // Si aún está cargando, marcar intención y esperar a que init() termine
    if (this.state === STATE.LOADING) {
      this._pendingOpen = true;
      return
    }

    this._setState(STATE.OPEN);
    this.session.isOpen = true;
    this.unreadCount = 0;
    this.session.unreadCount = 0;
    this._emit('opened');

    // Cargar historial si hay conversación previa
    if (this.conversationId) {
      // Mostrar caché inmediatamente si existe
      if (this.messages.length > 0) {
        this._emit('messages:loaded', { messages: this.messages });
      }
      // Siempre refrescar desde el servidor (incluye mensajes perdidos en desconexión)
      try {
        const { messages } = await this.api.getMessages(this.conversationId);
        this.messages = messages;
        this.session.setCachedMessages(messages);
        this._emit('messages:loaded', { messages });
      } catch (err) {
        // Conversación ya no existe en el backend — limpiar estado para empezar nueva
        if (err?.status === 404) {
          this._resetConversation();
          this._emit('messages:loaded', { messages: [] });
        }
      }
    }

    // Conectar WebSocket
    await this._connectSocket();
    if (this.conversationId) {
      this.socket.joinConversation(this.conversationId);
      this.api.markAsRead(this.conversationId).catch(() => {});
    }
  }

  close() {
    if (this.state !== STATE.OPEN) return
    this._setState(STATE.IDLE);
    this.session.isOpen = false;
    this._emit('closed');
  }

  toggle() {
    if (this.state === STATE.OPEN) this.close();
    else this.open();
  }

  async sendMessage(text) {
    if (!text?.trim()) return
    const content = text.trim();

    // Mensaje optimista en UI
    const tempId = `tmp_${Date.now()}`;
    const tempMsg = {
      _id: tempId,
      sender_type: 'contact',
      type: 'text',
      content,
      createdAt: new Date().toISOString(),
      _pending: true,
    };
    this.messages.push(tempMsg);
    this._emit('message:pending', { message: tempMsg });

    // Crear conversación si no existe
    if (!this.conversationId) {
      try {
        const result = await this.api.createConversation({
          workspaceId: this.config.workspace_id,
          channelId:   this.config.channel_id,
          metadata:    this.session.preChatData || {},
        });
        this.session.preChatData = null;
        this.conversationId = result.conversation_id;
        this.contactId      = result.contact_id;
        this.session.conversationId = this.conversationId;
        this.session.contactId      = this.contactId;

        // Esperar confirmación del socket join antes de enviar el mensaje
        // (evita la condición de carrera donde el bot responde antes de que el widget esté en la sala)
        if (this.socket) {
          await this.socket.joinConversation(this.conversationId);
        }

        // Obtener mensajes ya guardados en BD (ej. mensaje de bienvenida del bot)
        try {
          const { messages: existing } = await this.api.getMessages(this.conversationId);
          for (const msg of existing) {
            if (!this.messages.find(m => m._id === msg._id)) {
              this.messages.push(msg);
              this._emit('message:received', { message: msg });
            }
          }
          this.session.setCachedMessages(this.messages);
        } catch {}
      } catch (err) {
        this._removeTempMessage(tempId);
        this._emit('error', { message: 'No se pudo iniciar la conversación.' });
        return
      }
    }

    // Analizar para lead detection (después de que el contacto ya existe en BD)
    this.leadDetector?.analyze(content);

    try {
      await this.api.sendMessage(this.conversationId, content);
      this._confirmTempMessage(tempId);
    } catch (err) {
      this._removeTempMessage(tempId);
      if (err?.status === 404) {
        // La conversación fue eliminada — resetear y reenviar como nueva
        this._resetConversation();
        this.messages = [];
        this._emit('messages:loaded', { messages: [] });
        await this.sendMessage(content);
      } else {
        this._emit('error', { message: 'No se pudo enviar el mensaje.' });
      }
    }
  }

  async uploadFile(file) {
    if (!this.conversationId) {
      await this._ensureConversation();
    }
    this._setState(STATE.UPLOADING);
    try {
      const result = await this.api.uploadFile(this.conversationId, file);
      this._setState(STATE.OPEN);
      // Mostrar el archivo inmediatamente en el chat usando la respuesta de la API
      if (result?.message_id && result?.url) {
        const isImage = (result.mimetype || '').startsWith('image/');
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
        };
        this.messages.push(msg);
        this.session.setCachedMessages(this.messages);
        this._emit('message:received', { message: msg });
      }
      return result
    } catch (err) {
      this._setState(STATE.OPEN);
      this._emit('error', { message: 'No se pudo subir el archivo.' });
    }
  }

  identify(data) {
    if (!this.session) return
    const update = {};
    if (data.name)  update.name  = data.name;
    if (data.email) update.email = data.email;
    if (data.phone) update.phone = data.phone;
    if (Object.keys(update).length > 0) {
      this.api.updateContact(this.session.sessionId, this.config.workspace_id, update).catch(() => {});
    }
  }

  on(event, handler) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(handler);
    return () => this.listeners.get(event)?.delete(handler)
  }

  submitPreChatForm(data) {
    if (!this.session) return
    this.session.preChatFormDone = true;
    const update = {};
    if (data.phone)          update.phone          = data.phone;
    if (data.email)          update.email          = data.email;
    if (data.identification) update.identification = data.identification;
    if (Object.keys(update).length > 0) {
      this.session.preChatData = update;
    }
  }

  skipPreChatForm() {
    if (this.session) this.session.preChatFormDone = true;
  }

  destroy() {
    this.socket?.disconnect();
    this.socket = null;
    this._emit('destroyed');
  }

  // ── Privados ───────────────────────────────────────────────────────────

  async _connectSocket() {
    if (this.socket) return
    // No sobreescribir STATE.OPEN si ya fue seteado por open()
    if (this.state !== STATE.OPEN) this._setState(STATE.CONNECTING);
    try {
      this.socket = new SocketService(this.session.sessionId);
      await this.socket.connect();

      this.socket.on('connection:status', ({ connected }) => {
        if (connected) {
          // Re-unirse a la sala de conversación tras reconexión (el backend reinició o hubo corte)
          if (this.conversationId) {
            this.socket.joinConversation(this.conversationId);
          }
          if (this.state === STATE.RECONNECTING) {
            this._setState(STATE.OPEN);
            this._emit('connection:restored');
          }
        }
      });

      this.socket.on('connection:error', (data) => {
        this._setState(STATE.RECONNECTING);
        this._emit('connection:error', data);
      });

      this.socket.on('new:message', (msg) => {
        // Ignorar mensajes del propio visitante — ya se muestran como optimistas
        if (msg.sender_type === 'contact') return

        clearTimeout(this._typingTimeout);
        this.isTyping = false;
        this._emit('typing:changed', { isTyping: false });

        // Evitar duplicados (puede llegar por socket un mensaje ya cargado vía HTTP)
        if (this.messages.find(m => m._id === msg._id)) return

        this.messages.push(msg);
        this.session.setCachedMessages(this.messages);
        if (this.state !== STATE.OPEN) {
          this.unreadCount++;
          this.session.unreadCount = this.unreadCount;
          this._emit('unread:changed', { count: this.unreadCount });
        } else if (this.conversationId) {
          this.api.markAsRead(this.conversationId).catch(() => {});
        }
        this._emit('message:received', { message: msg });
      });

      this.socket.on('typing:start', () => {
        this.isTyping = true;
        this._emit('typing:changed', { isTyping: true });
        // Auto-apagar el indicador si no llega typing:stop ni new:message en 10 segundos
        clearTimeout(this._typingTimeout);
        this._typingTimeout = setTimeout(() => {
          if (this.isTyping) {
            this.isTyping = false;
            this._emit('typing:changed', { isTyping: false });
          }
        }, 5000);
      });

      this.socket.on('typing:stop', () => {
        clearTimeout(this._typingTimeout);
        this.isTyping = false;
        this._emit('typing:changed', { isTyping: false });
      });

      this.socket.on('conversation:assigned', (data) => {
        this._emit('conversation:assigned', data);
      });

      this.socket.on('conversation:resolved', (data) => {
        // Guardar el ID antes de resetear (para la encuesta)
        this._resolvedConvId = this.conversationId;
        // Resetear conversación: la próxima vez que el cliente escriba, se crea una nueva
        this._resetConversation();
        this._emit('conversation:resolved', data);
      });

      if (this.state !== STATE.OPEN) this._setState(STATE.OPEN);
    } catch (err) {
      this._setState(STATE.ERROR);
      this._emit('error', { message: 'No se pudo conectar al servidor.' });
    }
  }

  async _ensureConversation() {
    if (this.conversationId) return
    const result = await this.api.createConversation({
      workspaceId: this.config.workspace_id,
      channelId:   this.config.channel_id,
      metadata:    this.session.preChatData || {},
    });
    this.session.preChatData = null;
    this.conversationId = result.conversation_id;
    this.contactId      = result.contact_id;
    this.session.conversationId = this.conversationId;
    this.session.contactId      = this.contactId;
    this.socket?.joinConversation(this.conversationId);
  }

  async _handleLeadDetected(type, value) {
    if (!this.session) return
    try {
      await this.api.updateContact(this.session.sessionId, this.config.workspace_id, { [type]: value });
    } catch {}
  }

  async submitSurvey(conversationId, score, comment) {
    try {
      await this.api.submitSurvey(conversationId, score, comment);
    } catch {}
    if (this.session) this.session.pendingSurvey = null;
  }

  _resetConversation() {
    this.conversationId = null;
    this.contactId = null;
    this.messages = [];
    this.unreadCount = 0;
    this.session.conversationId = null;
    this.session.contactId = null;
    this.session.unreadCount = 0;
    this.session.setCachedMessages([]);
    // Generar nuevo session_id para que el próximo visitante sea un contacto nuevo
    const newSessionId = this.session.resetSessionId();
    this.api = new Api(newSessionId);
  }

  _setState(newState) {
    const prev = this.state;
    this.state = newState;
    this._emit('state:changed', { state: newState, prev });
  }

  _emit(event, data = {}) {
    for (const handler of this.listeners.get(event) ?? []) {
      try { handler(data); } catch {}
    }
  }

  _removeTempMessage(tempId) {
    this.messages = this.messages.filter(m => m._id !== tempId);
    this._emit('message:removed', { tempId });
  }

  _confirmTempMessage(tempId) {
    const msg = this.messages.find(m => m._id === tempId);
    if (msg) {
      delete msg._pending;
      this._emit('message:confirmed', { tempId });
    }
  }
}

/**
 * launcher-button.js — Botón flotante de apertura del widget.
 */

class LauncherButton {
  constructor(onClick) {
    this.onClick = onClick;
    this.el = this._build();
    this._badge = this.el.querySelector('.tw-badge');
    this._iconChat = this.el.querySelector('.tw-icon-chat');
    this._iconClose = this.el.querySelector('.tw-icon-close');
  }

  _build() {
    const el = document.createElement('button');
    el.className = 'tw-launcher';
    el.setAttribute('type', 'button');
    el.setAttribute('aria-label', 'Abrir chat');
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
    `;
    el.addEventListener('click', () => this.onClick?.());
    return el
  }

  setOpen(isOpen) {
    this._iconChat.hidden = isOpen;
    this._iconClose.hidden = !isOpen;
    this.el.setAttribute('aria-expanded', String(isOpen));
    if (isOpen) this.el.classList.add('tw-launcher--open');
    else this.el.classList.remove('tw-launcher--open');
  }

  setUnreadCount(n) {
    if (n > 0) {
      this._badge.hidden = false;
      this._badge.textContent = n > 99 ? '99+' : String(n);
    } else {
      this._badge.hidden = true;
    }
  }

  setColor(color) {
    this.el.style.setProperty('--tw-color-primary', color);
    this.el.style.setProperty('background', color);
  }

  setLogo(url) {
    if (!url) return
    this._iconChat.innerHTML = `<img src="${url}" alt="logo" class="tw-launcher-logo" />`;
  }
}

function formatRelativeTime(date) {
  const d = new Date(date);
  const now = Date.now();
  const diff = now - d.getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return 'ahora'
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `hace ${mins} min`
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`
  return d.toLocaleDateString('es', { day: 'numeric', month: 'short' })
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function linkify(text) {
  return text.replace(
    /(https?:\/\/[^\s<>"]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer" class="tw-link">$1</a>'
  )
}

/**
 * message-bubble.js — Crea un elemento DOM para un mensaje individual.
 */

function createMessageBubble(msg) {
  const isVisitor = msg.sender_type === 'contact';
  const wrap = document.createElement('div');
  wrap.className = `tw-message ${isVisitor ? 'tw-message--visitor' : 'tw-message--bot'}`;
  if (msg._pending) wrap.classList.add('tw-message--pending');
  wrap.dataset.id = msg._id;

  const inner = [];

  if (!isVisitor) {
    inner.push(`
      <div class="tw-avatar tw-avatar--sm">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      </div>
    `);
  }

  const bubbleClass = isVisitor ? 'tw-bubble--visitor' : 'tw-bubble--bot';
  const content = _renderContent(msg);
  const time = formatRelativeTime(msg.createdAt);
  const status = isVisitor ? _renderStatus(msg) : '';

  const quickRepliesHtml = msg.quickReplies?.length
    ? `<div class="tw-quick-replies">${msg.quickReplies.map((qr, i) =>
        `<button class="tw-qr-btn" data-idx="${i}">${_escHtml(qr.label)}</button>`
      ).join('')}</div>`
    : '';

  inner.push(`
    <div class="tw-bubble-wrap">
      <div class="tw-bubble ${bubbleClass}">${content}</div>
      <div class="tw-message-meta"><span class="tw-time" data-timestamp="${msg.createdAt}">${time}</span>${status}</div>
      ${quickRepliesHtml}
    </div>
  `);

  wrap.innerHTML = inner.join('');
  return wrap
}

function _renderContent(msg) {
  const att = msg.attachments?.[0];
  if (msg.type === 'image' && att?.url) {
    return `<img class="tw-msg-image" src="${_escHtml(att.url)}" alt="${_escHtml(att.filename || 'imagen')}" loading="lazy" />`
  }
  if ((msg.type === 'file' || msg.type === 'audio' || msg.type === 'video') && att?.url) {
    const name = att.filename || msg.content || 'Archivo';
    const size = att.size_bytes ? ` · ${formatFileSize(att.size_bytes)}` : '';
    return `
      <a class="tw-msg-file" href="${_escHtml(att.url)}" target="_blank" rel="noopener">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
        <span>${_escHtml(name)}${size}</span>
      </a>
    `
  }
  // text (or fallback if attachment URL not available yet)
  return linkify(_escHtml(msg.content || ''))
}

function _renderStatus(msg) {
  if (msg._pending) {
    return `<span class="tw-status tw-status--pending">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <circle cx="12" cy="12" r="10"/>
      </svg>
    </span>`
  }
  return `<span class="tw-status tw-status--sent">
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  </span>`
}

function _escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * typing-indicator.js — Indicador de "agente está escribiendo…"
 */

class TypingIndicator {
  constructor() {
    this.el = this._build();
  }

  _build() {
    const el = document.createElement('div');
    el.className = 'tw-message tw-message--bot tw-typing-wrap';
    el.hidden = true;
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
    `;
    return el
  }

  show() { this.el.hidden = false; }
  hide() { this.el.hidden = true; }
}

/**
 * message-list.js — Contenedor scrollable de mensajes.
 */

class MessageList {
  constructor(onQuickReply) {
    this.onQuickReply = onQuickReply;
    this.typing = new TypingIndicator();
    this.el = this._build();
    this._messages = [];
  }

  _build() {
    const el = document.createElement('div');
    el.className = 'tw-messages';
    el.setAttribute('role', 'log');
    el.setAttribute('aria-live', 'polite');
    el.appendChild(this.typing.el);
    el.addEventListener('click', (e) => {
      const btn = e.target.closest('.tw-qr-btn');
      if (btn) {
        const idx = parseInt(btn.dataset.idx, 10);
        const msgWrap = btn.closest('.tw-message');
        if (msgWrap) {
          const msgId = msgWrap.dataset.id;
          const msg = this._messages.find(m => m._id === msgId);
          if (msg?.quickReplies?.[idx]) {
            this.onQuickReply?.(msg.quickReplies[idx]);
          }
        }
      }
    });
    return el
  }

  setMessages(messages) {
    const safe = Array.isArray(messages) ? messages : [];
    // Conservar mensajes pendientes solo si no estamos limpiando todo (reset de conversación)
    const pending = safe.length > 0 ? this._messages.filter(m => m._pending) : [];
    // Limpiar mensajes normales y mensajes de sistema (tw-system-msg)
    this.el.querySelectorAll('.tw-message:not(.tw-typing-wrap), .tw-system-msg')
      .forEach(n => n.remove());
    this._messages = [];
    for (const msg of safe) {
      this._appendMessage(msg);
    }
    // Re-añadir los pendientes que aún no están confirmados en servidor
    for (const msg of pending) {
      if (!safe.find(m => m._id === msg._id)) {
        this._appendMessage(msg);
      }
    }
    this.typing.hide();
    this.scrollToBottom();
  }

  addMessage(msg) {
    this._appendMessage(msg);
    this.scrollToBottom();
  }

  updateMessage(tempId, confirmedMsg) {
    const el = this.el.querySelector(`[data-id="${tempId}"]`);
    if (el) {
      el.classList.remove('tw-message--pending');
      el.dataset.id = confirmedMsg?._id || tempId;
      const statusEl = el.querySelector('.tw-status--pending');
      if (statusEl) statusEl.className = 'tw-status tw-status--sent';
    }
    const idx = this._messages.findIndex(m => m._id === tempId);
    if (idx >= 0 && confirmedMsg) this._messages[idx] = confirmedMsg;
  }

  removeMessage(tempId) {
    const el = this.el.querySelector(`[data-id="${tempId}"]`);
    if (el) el.remove();
    this._messages = this._messages.filter(m => m._id !== tempId);
  }

  hideQuickReplies() {
    // Hide quick replies of the last bot message
    const all = this.el.querySelectorAll('.tw-quick-replies');
    all.forEach(qr => qr.style.display = 'none');
  }

  showTyping() { 
    this.typing.show();
    this.scrollToBottom();
  }
  
  hideTyping() { this.typing.hide(); }

  refreshTimestamps() {
    const els = this.el.querySelectorAll('.tw-time[data-timestamp]');
    for (const el of els) {
      el.textContent = formatRelativeTime(el.dataset.timestamp);
    }
  }

  /** Muestra un mensaje de sistema (aviso, cierre, etc.) sin agregarlo al historial */
  addSystemMessage(text) {
    const el = document.createElement('div');
    el.className = 'tw-system-msg';
    el.textContent = text;
    this.el.insertBefore(el, this.typing.el);
    this.scrollToBottom();
  }

  scrollToBottom(smooth = true) {
    this.el.scrollTo({ top: this.el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  }

  _appendMessage(msg) {
    const normalized = this._normalizeMsg(msg);
    const bubble = createMessageBubble(normalized);
    this.el.insertBefore(bubble, this.typing.el);
    this._messages.push(normalized);
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

/**
 * message-input.js — Área de entrada con textarea, adjuntos y envío.
 */

class MessageInput {
  constructor({ onSend, onAttach }) {
    this.onSend = onSend;
    this.onAttach = onAttach;
    this.el = this._build();
    this._fileInput = this.el.querySelector('.tw-file-input');
    this._textarea = this.el.querySelector('textarea');
    this._sendBtn = this.el.querySelector('.tw-send-btn');
  }

  _build() {
    const el = document.createElement('div');
    el.className = 'tw-footer';
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
    `;

    const textarea = el.querySelector('textarea');
    const sendBtn = el.querySelector('.tw-send-btn');
    const attachBtn = el.querySelector('.tw-attach-btn');
    const fileInput = el.querySelector('.tw-file-input');

    // Auto-resize textarea
    textarea.addEventListener('input', () => {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
      sendBtn.disabled = !textarea.value.trim();
    });

    textarea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this._doSend();
      }
    });

    sendBtn.addEventListener('click', () => this._doSend());

    attachBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      if (file) {
        this.onAttach?.(file);
        fileInput.value = '';
      }
    });

    return el
  }

  _doSend() {
    const text = this._textarea.value.trim();
    if (!text) return
    this.onSend?.(text);
    this._textarea.value = '';
    this._textarea.style.height = 'auto';
    this._sendBtn.disabled = true;
  }

  setPlaceholder(text) {
    this._textarea.placeholder = text;
  }

  focus() { this._textarea.focus(); }

  setDisabled(disabled) {
    this._textarea.disabled = disabled;
    this._sendBtn.disabled = disabled;
    this.el.querySelector('.tw-attach-btn').disabled = disabled;
  }
}

/**
 * chat-panel.js — Panel principal del chat (header + mensajes + input).
 * Tiene dos vistas: home (sin conversación) y chat (con conversación activa).
 */

class ChatPanel {
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

/**
 * widget-root.js — Custom Element raíz <chat-platform-widget>
 * Shadow DOM con CSS aislado. Coordina Core + todos los sub-componentes.
 */

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
`;

class ChatPlatformWidget extends HTMLElement {
  constructor() {
    super();
    this._shadow = this.attachShadow({ mode: 'open' });
    this._core = null;
    this._launcher = null;
    this._panel = null;
    this._initialized = false;
    this._timeInterval = null;
  }

  static get observedAttributes() {
    return ['workspace', 'position', 'color', 'dark']
  }

  connectedCallback() {
    if (!this._initialized) {
      this._render();
      this._initialized = true;
    }
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (!this._initialized) return
    if (name === 'color' && newVal) this._applyColor(newVal);
    if (name === 'dark') this._shadow.host.toggleAttribute('dark', newVal !== null);
  }

  disconnectedCallback() {
    clearInterval(this._timeInterval);
    this._timeInterval = null;
    this._core?.destroy();
  }

  _render() {
    const style = document.createElement('style');
    style.textContent = WIDGET_CSS;

    const host = document.createElement('div');
    host.className = 'tw-host';

    this._launcher = new LauncherButton(() => this._core?.toggle());
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
    });

    host.appendChild(this._panel.el);
    host.appendChild(this._launcher.el);

    this._shadow.appendChild(style);
    this._shadow.appendChild(host);

    const slug = this.getAttribute('workspace');
    if (!slug) { console.warn('[NexoraChat] falta atributo workspace'); return }

    this._core = new Core(slug);
    this._bindCore();
    this._core.init();
  }

  _bindCore() {
    const c = this._core;

    c.on('initialized', ({ config, unreadCount }) => {
      this._applyConfig(config);
      this._launcher.setUnreadCount(unreadCount);
    });

    c.on('opened', () => {
      this._launcher.setOpen(true);
      this._panel.show();
      this._panel.clearError();
      this._panel.messages.hideTyping();
      // Si el formulario pre-chat está activo y no se ha completado aún
      const pcf = c.config?.pre_chat_form;
      if (pcf?.enabled && !c.session?.preChatFormDone) {
        this._panel.showPreChatForm({
          collectPhone:          pcf.collect_phone,
          collectEmail:          pcf.collect_email,
          collectIdentification: pcf.collect_identification,
        });
      } else if (c.session?.pendingSurvey) {
        this._panel.showSurvey();
      } else if (c.conversationId && c.messages.length > 0) {
        this._panel.showChat();
      } else {
        this._panel.showHome();
      }
      // Refrescar timestamps mientras el panel está abierto
      clearInterval(this._timeInterval);
      this._timeInterval = setInterval(() => {
        this._panel.messages.refreshTimestamps();
      }, 60000);
    });

    c.on('closed', () => {
      this._launcher.setOpen(false);
      this._panel.hide();
      clearInterval(this._timeInterval);
      this._timeInterval = null;
    });

    c.on('state:changed', ({ state }) => {
      const connecting = state === STATE.CONNECTING || state === STATE.RECONNECTING;
      this._panel.setConnecting(connecting);
    });

    c.on('messages:loaded', ({ messages }) => {
      this._panel.messages.setMessages(messages);
      if (messages.length > 0) {
        // Restaurar el nombre del último emisor (bot o agente)
        const lastSenderMsg = [...messages].reverse().find(m => m.sender_type === 'bot' || m.sender_type === 'agent');
        if (lastSenderMsg?.sender_type === 'bot' && lastSenderMsg.ai_meta?.bot_name) {
          this._panel.setHeaderSender(lastSenderMsg.ai_meta.bot_name);
        } else if (lastSenderMsg?.sender_type === 'agent' && lastSenderMsg.sender_name) {
          this._panel.setHeaderSender(lastSenderMsg.sender_name);
        }
        this._panel.showChat();
      }
    });

    c.on('message:pending', ({ message }) => {
      this._panel.showChat();
      this._panel.messages.hideQuickReplies();
      this._panel.messages.addMessage(message);
    });

    c.on('message:received', ({ message }) => {
      this._panel.messages.addMessage(message);
      // Actualizar nombre del header según quien habla
      if (message.sender_type === 'bot' && message.ai_meta?.bot_name) {
        this._panel.setHeaderSender(message.ai_meta.bot_name);
      } else if (message.sender_type === 'agent' && message.sender_name) {
        this._panel.setHeaderSender(message.sender_name);
      }
    });

    c.on('message:confirmed', ({ tempId, message }) => {
      this._panel.messages.updateMessage(tempId, message);
    });

    c.on('message:removed', ({ tempId }) => {
      this._panel.messages.removeMessage(tempId);
    });

    c.on('typing:changed', ({ isTyping }) => {
      if (isTyping) this._panel.messages.showTyping();
      else this._panel.messages.hideTyping();
    });

    c.on('unread:changed', ({ count }) => {
      this._launcher.setUnreadCount(count);
    });

    c.on('connection:error', () => {
      this._panel.setError('Sin conexion, reintentando...');
    });

    c.on('connection:restored', () => {
      this._panel.clearError();
    });

    c.on('error', ({ message }) => {
      this._panel.setError(message);
      setTimeout(() => this._panel.clearError(), 4000);
    });

    c.on('conversation:assigned', ({ agent_name }) => {
      if (agent_name) this._panel.setHeaderSender(agent_name);
    });

    let _resolvedHandled = false;
    c.on('conversation:resolved', () => {
      if (_resolvedHandled) return
      _resolvedHandled = true;
      setTimeout(() => { _resolvedHandled = false; }, 5000);
      // Guardar encuesta pendiente en localStorage antes de resetear
      if (c.session && c._resolvedConvId) {
        c.session.pendingSurvey = { conversationId: c._resolvedConvId };
      }
      // Restaurar nombre del branding al resolver
      this._panel.setHeaderSender(null);
      // Limpiar mensajes y mostrar encuesta
      this._panel.messages.setMessages([]);
      this._panel.showSurvey();
    });
  }

  _applyConfig(config) {
    if (config.primary_color) this._applyColor(config.primary_color);
    this._panel.setConfig(config);
  }

  _applyColor(color) {
    const host = this._shadow.querySelector('.tw-host');
    if (host) {
      host.style.setProperty('--color-primary', color);
      host.style.setProperty('--color-primary-dark', _darken(color, 10));
      host.style.setProperty('--color-bubble-v', color);
    }
  }

  _handlePreChatSubmit(data) {
    const c = this._core;
    if (!c) return
    c.submitPreChatForm(data);
    if (c.session?.pendingSurvey) {
      this._panel.showSurvey();
    } else if (c.conversationId && c.messages.length > 0) {
      this._panel.showChat();
    } else {
      this._panel.showHome();
    }
  }

  _handlePreChatSkip() {
    this._core?.skipPreChatForm();
    this._panel.showHome();
  }

  async _handleSurveySubmit(score, comment) {
    const pending = this._core?.session?.pendingSurvey;
    if (pending?.conversationId) {
      await this._core?.submitSurvey(pending.conversationId, score, comment);
    }
    this._panel.showHome();
  }

  _handleSurveySkip() {
    if (this._core?.session) this._core.session.pendingSurvey = null;
    this._panel.showHome();
  }

  _handleQuickReply(qr) {
    this._panel.messages.hideQuickReplies();
    // No añadir el mensaje aquí: sendMessage() emite 'message:pending' que ya lo añade
    this._core?.sendMessage(qr.label);
  }

  widgetOpen()            { this._core?.open(); }
  widgetClose()           { this._core?.close(); }
  widgetToggle()          { this._core?.toggle(); }
  widgetIdentify(data)    { this._core?.identify(data); }
  widgetSendMessage(text) { this._core?.sendMessage(text); }
  widgetOn(event, cb)     { return this._core?.on(event, cb) }
  widgetDestroy()         { this._core?.destroy(); this.remove(); }
}

function _darken(hex, amount) {
  try {
    const n = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, (n >> 16) - Math.round(amount * 2.55));
    const g = Math.max(0, ((n >> 8) & 0xff) - Math.round(amount * 2.55));
    const b = Math.max(0, (n & 0xff) - Math.round(amount * 2.55));
    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')
  } catch { return hex }
}

if (!customElements.get('chat-platform-widget')) {
  customElements.define('chat-platform-widget', ChatPlatformWidget);
}

/**
 * index.js — Punto de entrada del widget.
 * Lee el data-workspace del script tag y arranca el widget.
 */


function init(config = {}) {
  const slug = config.workspace || getSlugFromScript();
  if (!slug) {
    console.warn('[NexoraChat] data-workspace no especificado.');
    return
  }

  // Crear el elemento raíz si no existe
  if (!customElements.get('chat-platform-widget')) {
    console.warn('[NexoraChat] Web Components no disponibles en este navegador.');
    return
  }

  let el = document.querySelector('chat-platform-widget');
  if (!el) {
    el = document.createElement('chat-platform-widget');
    // IMPORTANTE: poner atributos ANTES de appendChild
    // para que connectedCallback los vea desde el primer momento
    el.setAttribute('workspace', slug);
    if (config.position) el.setAttribute('position', config.position);
    if (config.color)    el.setAttribute('color', config.color);
    document.body.appendChild(el);
  } else {
    el.setAttribute('workspace', slug);
    if (config.position) el.setAttribute('position', config.position);
    if (config.color)    el.setAttribute('color', config.color);
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
  };

  return window.ChatWidget
}

function getSlugFromScript() {
  const scripts = document.querySelectorAll('script[data-workspace]');
  const current = scripts[scripts.length - 1];
  return current?.getAttribute('data-workspace') || null
}

// Auto-init si hay un script tag con data-workspace
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => init());
} else {
  init();
}
var index = { init };

export { index as default, init };
//# sourceMappingURL=widget.esm.js.map
