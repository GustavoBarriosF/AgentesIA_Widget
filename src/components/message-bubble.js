/**
 * message-bubble.js — Crea un elemento DOM para un mensaje individual.
 */
import { formatRelativeTime, linkify, formatFileSize } from '../utils/format.js'

export function createMessageBubble(msg) {
  const isVisitor = msg.sender_type === 'contact'
  const wrap = document.createElement('div')
  wrap.className = `tw-message ${isVisitor ? 'tw-message--visitor' : 'tw-message--bot'}`
  if (msg._pending) wrap.classList.add('tw-message--pending')
  wrap.dataset.id = msg._id

  const inner = []

  if (!isVisitor) {
    inner.push(`
      <div class="tw-avatar tw-avatar--sm">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      </div>
    `)
  }

  const bubbleClass = isVisitor ? 'tw-bubble--visitor' : 'tw-bubble--bot'
  const content = _renderContent(msg)
  const time = formatRelativeTime(msg.createdAt)
  const status = isVisitor ? _renderStatus(msg) : ''

  const quickRepliesHtml = msg.quickReplies?.length
    ? `<div class="tw-quick-replies">${msg.quickReplies.map((qr, i) =>
        `<button class="tw-qr-btn" data-idx="${i}">${_escHtml(qr.label)}</button>`
      ).join('')}</div>`
    : ''

  inner.push(`
    <div class="tw-bubble-wrap">
      <div class="tw-bubble ${bubbleClass}">${content}</div>
      <div class="tw-message-meta"><span class="tw-time" data-timestamp="${msg.createdAt}">${time}</span>${status}</div>
      ${quickRepliesHtml}
    </div>
  `)

  wrap.innerHTML = inner.join('')
  return wrap
}

function _renderContent(msg) {
  const att = msg.attachments?.[0]
  if (msg.type === 'image' && att?.url) {
    return `<img class="tw-msg-image" src="${_escHtml(att.url)}" alt="${_escHtml(att.filename || 'imagen')}" loading="lazy" />`
  }
  if ((msg.type === 'file' || msg.type === 'audio' || msg.type === 'video') && att?.url) {
    const name = att.filename || msg.content || 'Archivo'
    const size = att.size_bytes ? ` · ${formatFileSize(att.size_bytes)}` : ''
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
