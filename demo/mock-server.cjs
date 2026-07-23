/**
 * mock-server.js - Servidor de desarrollo para probar el widget sin backend real.
 * Uso: node demo/mock-server.js
 */
const http = require('http')
const path = require('path')
const fs   = require('fs')

const PORT = 3099
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-session-id',
  'Content-Type': 'application/json',
}

const conversations = new Map()
const messagesByConv = new Map()

function makeId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

const BOT_RESPONSES = [
  'Hola! Bienvenido a Nordex Solutions. En que puedo ayudarte?',
  'Entendido. Permiteme revisar eso.',
  'Claro, con gusto te ayudo. Dame un momento.',
  'Excelente pregunta. Aqui tienes la informacion que necesitas.',
  'Gracias por contactarnos. Nuestro equipo revisara tu solicitud pronto.',
  'Para una atencion mas personalizada te conectare con un agente.',
]
let botIdx = 0

function nextBot() {
  return BOT_RESPONSES[botIdx++ % BOT_RESPONSES.length]
}

function send(res, status, data) {
  if (status === 204) { res.writeHead(204, CORS); return res.end() }
  res.writeHead(status, CORS)
  res.end(JSON.stringify(data))
}

function serveFile(res, urlPath) {
  const filePath = path.join(__dirname, '..', urlPath)
  if (!fs.existsSync(filePath)) { res.writeHead(404); return res.end('Not found') }
  const ext = path.extname(filePath)
  const mime = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.map': 'application/json' }
  res.writeHead(200, { 'Content-Type': mime[ext] || 'text/plain', 'Access-Control-Allow-Origin': '*' })
  fs.createReadStream(filePath).pipe(res)
}

function handleRoute(req, res, pathname, body) {
  if (req.method === 'GET' && /^\/widget\/config\/\w+/.test(pathname)) {
    return send(res, 200, {
      workspace_id: 'ws_demo_001',
      workspace_name: 'Nordex Solutions',
      channel_id: 'ch_demo_001',
      bot_name: 'Asistente Nordex',
      primary_color: '#4F46E5',
      logo_url: null,
      welcome_message: 'Hola! Bienvenido a Nordex Solutions. Como podemos ayudarte?',
      placeholder: 'Escribe tu mensaje...',
      bot_enabled: true,
      position: 'right',
    })
  }

  if (req.method === 'POST' && pathname === '/widget/conversations') {
    const convId = 'conv_' + makeId()
    const contactId = 'contact_' + makeId()
    conversations.set(convId, { contactId, session_id: body.session_id })
    messagesByConv.set(convId, [])
    return send(res, 201, { conversation_id: convId, contact_id: contactId, is_new: true })
  }

  const msgsMatch = pathname.match(/^\/widget\/conversations\/([^/]+)\/messages/)
  if (req.method === 'GET' && msgsMatch) {
    return send(res, 200, { messages: messagesByConv.get(msgsMatch[1]) || [], has_more: false })
  }

  if (req.method === 'POST' && pathname === '/widget/messages') {
    const convId = body.conversation_id
    const msgs = messagesByConv.get(convId) || []
    const visitorMsg = {
      _id: 'msg_' + makeId(),
      conversation_id: convId,
      sender_type: 'contact',
      type: 'text',
      content: body.content,
      createdAt: new Date().toISOString(),
    }
    msgs.push(visitorMsg)
    messagesByConv.set(convId, msgs)
    send(res, 201, visitorMsg)
    setTimeout(function() {
      msgs.push({
        _id: 'msg_' + makeId(),
        conversation_id: convId,
        sender_type: 'agent',
        type: 'text',
        content: nextBot(),
        createdAt: new Date().toISOString(),
      })
    }, 1200)
    return
  }

  if (req.method === 'POST' && pathname === '/widget/messages/read') {
    return send(res, 204, null)
  }

  if (req.method === 'PATCH' && pathname.startsWith('/widget/contacts/')) {
    console.log('[Mock] Lead detectado:', body)
    return send(res, 200, { updated: true })
  }

  if (req.method === 'POST' && pathname === '/widget/messages/upload') {
    return send(res, 201, {
      _id: 'msg_' + makeId(),
      sender_type: 'contact',
      type: 'file',
      file_url: 'https://placehold.co/300x200',
      file_name: 'archivo_demo.pdf',
      file_size: 12345,
      createdAt: new Date().toISOString(),
    })
  }

  send(res, 404, { error: 'Ruta no encontrada: ' + pathname })
}

var server = http.createServer(function(req, res) {
  var url = new URL(req.url, 'http://localhost:' + PORT)
  var pathname = url.pathname

  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end() }

  if (pathname.startsWith('/dist/') || pathname.startsWith('/demo/')) {
    return serveFile(res, pathname)
  }

  if (pathname.endsWith('socket.io.js')) {
    var mock = 'window.io=function(u,o){var h={};var s={connected:true,on:function(e,f){h[e]=f;return s},emit:function(e,d){console.log("[MockSocket]",e,d)},disconnect:function(){}};setTimeout(function(){if(h.connect)h.connect()},50);return s};'
    res.writeHead(200, { 'Content-Type': 'text/javascript', 'Access-Control-Allow-Origin': '*' })
    return res.end(mock)
  }

  if (pathname.startsWith('/socket.io/')) {
    res.writeHead(200, CORS)
    return res.end('{}')
  }

  var body = ''
  req.on('data', function(d) { body += d })
  req.on('end', function() {
    try { handleRoute(req, res, pathname, body ? JSON.parse(body) : {}) }
    catch(e) { send(res, 400, { error: 'JSON invalido' }) }
  })
})

server.on('error', function(err) {
  if (err.code === 'EADDRINUSE') {
    console.error('\n  ERROR: Puerto ' + PORT + ' ya en uso.')
    console.error('  Ejecuta en PowerShell para liberar el puerto:')
    console.error('  Get-Process -Id (Get-NetTCPConnection -LocalPort ' + PORT + ').OwningProcess | Stop-Process -Force\n')
    process.exit(1)
  } else {
    throw err
  }
})

server.listen(PORT, function() {
  console.log('\n  Mock Server NexoraChat Widget')
  console.log('  Corriendo en: http://localhost:' + PORT)
  console.log('  Abre en el navegador: http://localhost:' + PORT + '/demo/index.html\n')
})
