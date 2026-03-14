import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set')
  }
  return Buffer.from(key, 'hex')
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, getKey(), iv)

  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  const authTag = cipher.getAuthTag()

  // Format: iv:ciphertext:authTag (all hex)
  return `${iv.toString('hex')}:${encrypted}:${authTag.toString('hex')}`
}

export function decrypt(ciphertext: string): string {
  const [ivHex, encryptedHex, authTagHex] = ciphertext.split(':')

  if (!ivHex || !encryptedHex || !authTagHex) {
    throw new Error('Invalid ciphertext format. Expected iv:ciphertext:authTag')
  }

  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}
