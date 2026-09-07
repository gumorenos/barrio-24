import { describe, expect, it } from 'vitest'
import {
  emptyMedicalCard,
  encryptMedicalCard,
  isMedicalCardRecord,
  parseMedicalCardRecord,
  unlockMedicalCard,
  validateMedicalCard,
} from './medical-card'

describe('Tarjeta Médica Offline', () => {
  it('cifra la información antes de crear el respaldo local', async () => {
    const card = { ...emptyMedicalCard(), nameOrAlias: 'Persona de prueba', allergies: 'Dato sintético' }
    const record = await encryptMedicalCard(card, 'codigo-seguro')

    expect(JSON.stringify(record)).not.toContain('Persona de prueba')
    expect(JSON.stringify(record)).not.toContain('Dato sintético')
    expect(record.ciphertext).toEqual(expect.any(String))
  })

  it('solo permite abrir la tarjeta con el código correcto', async () => {
    const card = { ...emptyMedicalCard(), nameOrAlias: 'Persona de prueba' }
    const record = await encryptMedicalCard(card, 'codigo-seguro')

    await expect(unlockMedicalCard(record, 'incorrecto')).rejects.toThrow('No se pudo abrir')
    await expect(unlockMedicalCard(record, 'codigo-seguro')).resolves.toMatchObject({
      card: { nameOrAlias: 'Persona de prueba' },
    })
  })

  it('rechaza un respaldo cuya información cifrada fue manipulada', async () => {
    const card = { ...emptyMedicalCard(), nameOrAlias: 'Persona de prueba' }
    const record = await encryptMedicalCard(card, 'codigo-seguro')
    const firstCharacter = record.ciphertext[0]
    const replacement = firstCharacter === 'A' ? 'B' : 'A'
    const tampered = { ...record, ciphertext: `${replacement}${record.ciphertext.slice(1)}` }

    expect(isMedicalCardRecord(tampered)).toBe(true)
    await expect(unlockMedicalCard(tampered, 'codigo-seguro')).rejects.toThrow('No se pudo abrir')
  })

  it('rechaza una tarjeta sin identificador mínimo', () => {
    expect(validateMedicalCard(emptyMedicalCard())).toContain('Escribe un nombre o alias para identificar la tarjeta.')
  })

  it('valida que un respaldo importado conserve su formato cifrado', async () => {
    const record = await encryptMedicalCard({ ...emptyMedicalCard(), nameOrAlias: 'Persona de prueba' }, 'codigo-seguro')
    expect(parseMedicalCardRecord(JSON.stringify(record))).toEqual(record)
    expect(() => parseMedicalCardRecord(JSON.stringify({ id: 'other' }))).toThrow('formato válido')
    expect(() => parseMedicalCardRecord(JSON.stringify({ ...record, iv: 'AA==' }))).toThrow('formato válido')
  })
})
