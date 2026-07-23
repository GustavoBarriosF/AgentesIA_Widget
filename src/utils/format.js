export function formatRelativeTime(date) {
  const d = new Date(date)
  const now = Date.now()
  const diff = now - d.getTime()
  const secs = Math.floor(diff / 1000)
  if (secs < 60) return 'ahora'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `hace ${mins} min`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `hace ${hrs}h`
  return d.toLocaleDateString('es', { day: 'numeric', month: 'short' })
}

export function formatDuration(seconds) {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function truncateFilename(name, max = 24) {
  if (name.length <= max) return name
  const ext = name.split('.').pop()
  return `${name.slice(0, max - ext.length - 4)}...${ext}`
}

export function linkify(text) {
  return text.replace(
    /(https?:\/\/[^\s<>"]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer" class="tw-link">$1</a>'
  )
}
