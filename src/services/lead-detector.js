import { detectEmail, detectPhone, detectName } from '../utils/patterns.js'

export class LeadDetector {
  constructor(onDetected) {
    this.onDetected = onDetected
    this._detected = { email: false, phone: false, name: false }
  }

  analyze(text) {
    if (!this._detected.email) {
      const email = detectEmail(text)
      if (email) {
        this._detected.email = true
        this.onDetected({ type: 'email', value: email })
      }
    }
    if (!this._detected.phone) {
      const phone = detectPhone(text)
      if (phone) {
        this._detected.phone = true
        this.onDetected({ type: 'phone', value: phone })
      }
    }
    if (!this._detected.name) {
      const name = detectName(text)
      if (name) {
        this._detected.name = true
        this.onDetected({ type: 'name', value: name })
      }
    }
  }

  reset() {
    this._detected = { email: false, phone: false, name: false }
  }
}
