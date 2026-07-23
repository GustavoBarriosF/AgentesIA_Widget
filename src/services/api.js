/**
 * api.js — Wrapper sobre fetch para peticiones al backend del widget.
 */

const BACKEND_URL = __BACKEND_URL__

export class Api {
  constructor(sessionId) {
    this.sessionId = sessionId
    this.baseUrl = BACKEND_URL
  }

  async _request(method, path, body, isMultipart = false) {
    const url = `${this.baseUrl}${path}`
    const headers = { 'x-session-id': this.sessionId }
    if (!isMultipart) headers['Content-Type'] = 'application/json'

    const opts = { method, headers }
    if (body) {
      opts.body = isMultipart ? body : JSON.stringify(body)
    }

    let lastErr
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(url, opts)
        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: res.statusText }))
          throw Object.assign(new Error(err.error || res.statusText), { status: res.status })
        }
        return res.status === 204 ? null : res.json()
      } catch (err) {
        lastErr = err
        if (err.status && err.status < 500) throw err // No reintentar errores del cliente
        if (attempt < 2) await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
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
    const params = new URLSearchParams({ session_id: this.sessionId, limit })
    if (before) params.set('before', before)
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
    const fd = new FormData()
    fd.append('file', file)
    fd.append('conversation_id', conversationId)
    fd.append('session_id', this.sessionId)
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
