import { Api } from './services/api.js'

let _config = null

export async function loadConfig(slug, sessionId) {
  if (_config) return _config
  const api = new Api(sessionId)
  try {
    _config = await api.getConfig(slug)
    return _config
  } catch (err) {
    throw new Error(`No se pudo cargar la configuración del widget: ${err.message}`)
  }
}

export function getConfig() {
  return _config
}
