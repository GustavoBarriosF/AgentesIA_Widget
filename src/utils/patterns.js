// Detectores para lead capture (email, phone, name)

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g

const PHONE_RE = /(?:\+?\d{1,3}[\s\-.]?)?\(?\d{1,4}\)?[\s\-.]?\d{3,4}[\s\-.]?\d{3,4}/g

const NAME_TRIGGERS = ['me llamo', 'soy', 'mi nombre es', 'habla', 'te escribe', 'les escribe']

const DAYS_MONTHS = new Set(['lunes','martes','miércoles','jueves','viernes','sábado','domingo',
  'enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'])

export function detectEmail(text) {
  const matches = [...text.matchAll(EMAIL_RE)]
  return matches.length ? matches[0][0] : null
}

export function detectPhone(text) {
  const lower = text.toLowerCase()
  const hasContext = /llama|whatsapp|cel|celular|número|telefon|al \+|contacto|movil|móvil/.test(lower)
  const matches = [...text.matchAll(PHONE_RE)]
  if (!matches.length) return null
  const num = matches[0][0].replace(/[\s\-.()]/g, '')
  if (num.length < 7) return null
  // Filtrar años y códigos de 4 dígitos
  if (/^(19|20)\d{2}$/.test(num)) return null
  return hasContext || num.length >= 8 ? matches[0][0] : null
}

export function detectName(text) {
  const lower = text.toLowerCase()
  const trigger = NAME_TRIGGERS.find(t => lower.includes(t))
  if (!trigger) return null
  const afterTrigger = lower.indexOf(trigger) + trigger.length
  const rest = text.slice(afterTrigger).trim()
  const words = rest.split(/\s+/).slice(0, 3)
  const nameWords = words.filter(w => {
    if (w.length < 2) return false
    if (DAYS_MONTHS.has(w.toLowerCase())) return false
    return true
  })
  if (nameWords.length < 1) return null
  // Capitalizar cada palabra del nombre
  return nameWords.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
}
