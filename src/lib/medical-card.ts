export const MEDICAL_CARD_ID = 'current'
export const MEDICAL_CARD_SCHEMA_VERSION = 1

const PBKDF2_ITERATIONS = 150_000
const encoder = new TextEncoder()
const decoder = new TextDecoder()

export interface MedicalCard {
  nameOrAlias: string
  birthYear: string
  bloodType: string
  allergies: string
  medications: string
  conditions: string
  accessibility: string
  emergencyContactName: string
  emergencyContactPhone: string
  criticalNotes: string
}

export interface MedicalCardRecord {
  id: string
  schemaVersion: number
  salt: string
  iv: string
  ciphertext: string
  updatedAt: number
}

export interface MedicalCardSession {
  key: CryptoKey
  salt: string
}

export function emptyMedicalCard(): MedicalCard {
  return {
    nameOrAlias: '',
    birthYear: '',
    bloodType: '',
    allergies: '',
    medications: '',
    conditions: '',
    accessibility: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    criticalNotes: '',
  }
}

export function validateMedicalCard(card: MedicalCard): string[] {
  const errors: string[] = []
  const limits: Array<[keyof MedicalCard, number, string]> = [
    ['nameOrAlias', 100, 'El nombre o alias'],
    ['bloodType', 30, 'El tipo de sangre'],
    ['allergies', 1_000, 'Las alergias'],
    ['medications', 1_000, 'Los medicamentos'],
    ['conditions', 1_000, 'Las condiciones médicas'],
    ['accessibility', 500, 'Las necesidades de accesibilidad'],
    ['emergencyContactName', 100, 'El nombre del contacto'],
    ['emergencyContactPhone', 40, 'El teléfono del contacto'],
    ['criticalNotes', 1_000, 'Las indicaciones críticas'],
  ]

  if (!card.nameOrAlias.trim()) {
    errors.push('Escribe un nombre o alias para identificar la tarjeta.')
  }

  if (card.birthYear && !/^\d{4}$/.test(card.birthYear)) {
    errors.push('El año de nacimiento debe tener cuatro cifras.')
  }

  if (card.birthYear) {
    const year = Number(card.birthYear)
    const currentYear = new Date().getFullYear()
    if (year < currentYear - 120 || year > currentYear) {
      errors.push('El año de nacimiento no parece válido.')
    }
  }

  for (const [field, limit, label] of limits) {
    if (card[field].length > limit) {
      errors.push(`${label} supera el máximo de ${limit} caracteres.`)
    }
  }

  return errors
}

function getCrypto(): Crypto {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Este navegador no ofrece cifrado local compatible.')
  }
  return globalThis.crypto
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  getCrypto().getRandomValues(bytes)
  return bytes
}

function asBufferSource(value: Uint8Array): BufferSource {
  return value as unknown as BufferSource
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

function hasBase64Length(value: string, expectedBytes: number): boolean {
  try {
    return base64ToBytes(value).byteLength === expectedBytes
  } catch {
    return false
  }
}

function hasValidCiphertext(value: string): boolean {
  try {
    // AES-GCM appends a 16-byte authentication tag to every ciphertext.
    return base64ToBytes(value).byteLength >= 16
  } catch {
    return false
  }
}

function assertPasscode(passcode: string): void {
  if (passcode.trim().length < 6) {
    throw new Error('El código de acceso debe tener al menos 6 caracteres.')
  }
}

async function deriveKey(passcode: string, salt: Uint8Array): Promise<CryptoKey> {
  assertPasscode(passcode)
  const cryptoApi = getCrypto()
  const material = await cryptoApi.subtle.importKey(
    'raw',
    asBufferSource(encoder.encode(passcode)),
    'PBKDF2',
    false,
    ['deriveKey'],
  )

  return cryptoApi.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: asBufferSource(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

function assertRecord(value: unknown): asserts value is MedicalCardRecord {
  if (!isMedicalCardRecord(value)) {
    throw new Error('El respaldo de la tarjeta no tiene un formato válido.')
  }
}

export function isMedicalCardRecord(value: unknown): value is MedicalCardRecord {
  if (!value || typeof value !== 'object') return false
  const record = value as Partial<MedicalCardRecord>
  return record.id === MEDICAL_CARD_ID
    && record.schemaVersion === MEDICAL_CARD_SCHEMA_VERSION
    && typeof record.salt === 'string'
    && typeof record.iv === 'string'
    && typeof record.ciphertext === 'string'
    && typeof record.updatedAt === 'number'
    && Number.isSafeInteger(record.updatedAt)
    && record.updatedAt > 0
    && hasBase64Length(record.salt, 16)
    && hasBase64Length(record.iv, 12)
    && hasValidCiphertext(record.ciphertext)
}

export function parseMedicalCardRecord(serialized: string): MedicalCardRecord {
  let parsed: unknown
  try {
    parsed = JSON.parse(serialized)
  } catch {
    throw new Error('El archivo no contiene un respaldo JSON válido.')
  }
  assertRecord(parsed)
  return parsed
}

export async function encryptMedicalCard(
  card: MedicalCard,
  passcode: string,
  now = Date.now(),
): Promise<MedicalCardRecord> {
  const errors = validateMedicalCard(card)
  if (errors.length > 0) throw new Error(errors[0])

  const salt = randomBytes(16)
  const session: MedicalCardSession = {
    key: await deriveKey(passcode, salt),
    salt: bytesToBase64(salt),
  }
  return encryptMedicalCardWithSession(card, session, now)
}

export async function encryptMedicalCardWithSession(
  card: MedicalCard,
  session: MedicalCardSession,
  now = Date.now(),
): Promise<MedicalCardRecord> {
  const errors = validateMedicalCard(card)
  if (errors.length > 0) throw new Error(errors[0])

  const iv = randomBytes(12)
  const ciphertext = await getCrypto().subtle.encrypt(
    { name: 'AES-GCM', iv: asBufferSource(iv) },
    session.key,
    asBufferSource(encoder.encode(JSON.stringify(card))),
  )

  return {
    id: MEDICAL_CARD_ID,
    schemaVersion: MEDICAL_CARD_SCHEMA_VERSION,
    salt: session.salt,
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    updatedAt: now,
  }
}

export async function unlockMedicalCard(
  record: MedicalCardRecord,
  passcode: string,
): Promise<{ card: MedicalCard; session: MedicalCardSession }> {
  assertRecord(record)

  try {
    const salt = base64ToBytes(record.salt)
    const iv = base64ToBytes(record.iv)
    const session: MedicalCardSession = {
      key: await deriveKey(passcode, salt),
      salt: record.salt,
    }
    const plaintext = await getCrypto().subtle.decrypt(
      { name: 'AES-GCM', iv: asBufferSource(iv) },
      session.key,
      asBufferSource(base64ToBytes(record.ciphertext)),
    )
    const parsed: unknown = JSON.parse(decoder.decode(plaintext))
    if (!isMedicalCard(parsed) || validateMedicalCard(parsed).length > 0) {
      throw new Error('invalid-card')
    }
    return { card: parsed, session }
  } catch {
    throw new Error('No se pudo abrir la tarjeta. Revisa el código de acceso.')
  }
}

function isMedicalCard(value: unknown): value is MedicalCard {
  if (!value || typeof value !== 'object') return false
  const card = value as Partial<MedicalCard>
  const fields: Array<keyof MedicalCard> = [
    'nameOrAlias',
    'birthYear',
    'bloodType',
    'allergies',
    'medications',
    'conditions',
    'accessibility',
    'emergencyContactName',
    'emergencyContactPhone',
    'criticalNotes',
  ]
  return fields.every((field) => typeof card[field] === 'string')
}
