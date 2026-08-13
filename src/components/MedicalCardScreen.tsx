import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import {
  ArrowLeft,
  Check,
  Download,
  Eye,
  EyeOff,
  LockKeyhole,
  Save,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { db } from '../lib/db'
import {
  emptyMedicalCard,
  encryptMedicalCard,
  encryptMedicalCardWithSession,
  MEDICAL_CARD_ID,
  parseMedicalCardRecord,
  type MedicalCard,
  type MedicalCardSession,
  unlockMedicalCard,
  validateMedicalCard,
} from '../lib/medical-card'

type MedicalCardMode = 'loading' | 'setup' | 'locked' | 'editing' | 'emergency'

interface MedicalCardScreenProps {
  onBack: () => void
}

const fields: Array<{
  key: keyof MedicalCard
  label: string
  hint: string
  placeholder: string
  multiline?: boolean
}> = [
  {
    key: 'nameOrAlias',
    label: 'Nombre o alias',
    hint: 'Solo lo necesario para identificarte.',
    placeholder: 'Ej. Gustavo M.',
  },
  {
    key: 'birthYear',
    label: 'Año de nacimiento',
    hint: 'Opcional. No guardamos la fecha completa.',
    placeholder: 'Ej. 1984',
  },
  {
    key: 'bloodType',
    label: 'Tipo de sangre',
    hint: 'Se mostrará como autodeclarado; debe confirmarse.',
    placeholder: 'Ej. O positivo',
  },
  {
    key: 'allergies',
    label: 'Alergias',
    hint: 'Incluye reacciones relevantes.',
    placeholder: 'Ej. Penicilina…',
    multiline: true,
  },
  {
    key: 'medications',
    label: 'Medicamentos y dosis',
    hint: 'Indica lo que podría ser importante en una emergencia.',
    placeholder: 'Ej. Medicamento — dosis — frecuencia',
    multiline: true,
  },
  {
    key: 'conditions',
    label: 'Condiciones médicas relevantes',
    hint: 'No es una historia clínica completa.',
    placeholder: 'Ej. Asma, diabetes…',
    multiline: true,
  },
  {
    key: 'accessibility',
    label: 'Necesidades de accesibilidad',
    hint: 'Apoyos o indicaciones para ayudarte.',
    placeholder: 'Ej. Usa bastón; requiere apoyo para oír',
    multiline: true,
  },
  {
    key: 'emergencyContactName',
    label: 'Contacto de emergencia',
    hint: 'Nombre o relación.',
    placeholder: 'Ej. Ana — hermana',
  },
  {
    key: 'emergencyContactPhone',
    label: 'Teléfono del contacto',
    hint: 'Se guarda únicamente en este dispositivo.',
    placeholder: 'Ej. +51 999 999 999',
  },
  {
    key: 'criticalNotes',
    label: 'Indicaciones críticas',
    hint: 'Información breve que alguien debería conocer.',
    placeholder: 'Ej. Llevo un inhalador en la mochila azul',
    multiline: true,
  },
]

function Field({
  definition,
  value,
  onChange,
}: {
  definition: (typeof fields)[number]
  value: string
  onChange: (value: string) => void
}) {
  const inputId = `medical-${definition.key}`
  return (
    <label className={`medical-field ${definition.multiline ? 'wide' : ''}`} htmlFor={inputId}>
      <span className="medical-field-label">{definition.label}</span>
      <span className="medical-field-hint">{definition.hint}</span>
      {definition.multiline ? (
        <textarea
          id={inputId}
          rows={3}
          autoComplete="off"
          value={value}
          placeholder={definition.placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <input
          id={inputId}
          autoComplete="off"
          value={value}
          placeholder={definition.placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </label>
  )
}

function AccessCodeField({
  value,
  onChange,
  label,
  inputId = 'medical-access-code',
  autoFocus = false,
}: {
  value: string
  onChange: (value: string) => void
  label: string
  inputId?: string
  autoFocus?: boolean
}) {
  const [visible, setVisible] = useState(false)
  return (
    <label className="medical-code-field" htmlFor={inputId}>
      <span className="medical-field-label">{label}</span>
      <span className="medical-field-hint">Mínimo 6 caracteres. No se guarda en el dispositivo.</span>
      <span className="medical-code-input">
        <input
          id={inputId}
          autoFocus={autoFocus}
          type={visible ? 'text' : 'password'}
          autoComplete="new-password"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          className="icon-button"
          type="button"
          aria-label={visible ? 'Ocultar código' : 'Mostrar código'}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>
      </span>
    </label>
  )
}

function Notice({ children, tone = 'info' }: { children: React.ReactNode; tone?: 'info' | 'warning' | 'success' }) {
  return <div className={`medical-notice ${tone}`} role="status">{children}</div>
}

export default function MedicalCardScreen({ onBack }: MedicalCardScreenProps) {
  const [mode, setMode] = useState<MedicalCardMode>('loading')
  const [card, setCard] = useState<MedicalCard>(emptyMedicalCard)
  const [draft, setDraft] = useState<MedicalCard>(emptyMedicalCard)
  const [accessCode, setAccessCode] = useState('')
  const [confirmationCode, setConfirmationCode] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [deleteRequested, setDeleteRequested] = useState(false)
  const [emergencySeconds, setEmergencySeconds] = useState(60)
  const sessionRef = useRef<MedicalCardSession | null>(null)
  const importInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let active = true
    void db.medicalCard.get(MEDICAL_CARD_ID).then((record) => {
      if (!active) return
      setMode(record ? 'locked' : 'setup')
    }).catch(() => {
      if (active) {
        setError('No se pudo revisar el almacenamiento local.')
        setMode('setup')
      }
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (mode !== 'emergency') return
    setEmergencySeconds(60)
    const interval = window.setInterval(() => {
      setEmergencySeconds((current) => {
        if (current <= 1) {
          window.clearInterval(interval)
          setMode('editing')
          return 0
        }
        return current - 1
      })
    }, 1_000)
    return () => window.clearInterval(interval)
  }, [mode])

  useEffect(() => {
    return () => {
      sessionRef.current = null
    }
  }, [])

  useEffect(() => {
    if (mode !== 'emergency') return

    function closeWhenHidden() {
      if (document.visibilityState === 'hidden') setMode('editing')
    }

    document.addEventListener('visibilitychange', closeWhenHidden)
    return () => document.removeEventListener('visibilitychange', closeWhenHidden)
  }, [mode])

  function updateDraft(field: keyof MedicalCard, value: string) {
    setDraft((current) => ({ ...current, [field]: value }))
  }

  function updateCard(field: keyof MedicalCard, value: string) {
    setCard((current) => ({ ...current, [field]: value }))
  }

  function clearFeedback() {
    setError('')
    setMessage('')
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    clearFeedback()
    const errors = validateMedicalCard(draft)
    if (errors.length > 0) {
      setError(errors[0])
      return
    }
    if (accessCode.trim().length < 6) {
      setError('El código de acceso debe tener al menos 6 caracteres.')
      return
    }
    if (accessCode !== confirmationCode) {
      setError('Los códigos de acceso no coinciden.')
      return
    }

    setIsSaving(true)
    try {
      const record = await encryptMedicalCard(draft, accessCode)
      const unlocked = await unlockMedicalCard(record, accessCode)
      await db.medicalCard.put(record)
      sessionRef.current = unlocked.session
      setCard(unlocked.card)
      setAccessCode('')
      setConfirmationCode('')
      setMode('editing')
      setMessage('Tarjeta creada y guardada cifrada en este dispositivo.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo guardar la tarjeta.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleUnlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    clearFeedback()
    setIsSaving(true)
    try {
      const record = await db.medicalCard.get(MEDICAL_CARD_ID)
      if (!record) throw new Error('No existe una tarjeta guardada.')
      const unlocked = await unlockMedicalCard(record, accessCode)
      sessionRef.current = unlocked.session
      setCard(unlocked.card)
      setAccessCode('')
      setMode('editing')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo abrir la tarjeta.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    clearFeedback()
    const errors = validateMedicalCard(card)
    if (errors.length > 0) {
      setError(errors[0])
      return
    }
    if (!sessionRef.current) {
      setMode('locked')
      setError('La sesión se cerró. Abre la tarjeta para continuar.')
      return
    }

    setIsSaving(true)
    try {
      const record = await encryptMedicalCardWithSession(card, sessionRef.current)
      await db.medicalCard.put(record)
      setMessage('Cambios guardados cifrados en este dispositivo.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudieron guardar los cambios.')
    } finally {
      setIsSaving(false)
    }
  }

  function lockCard() {
    sessionRef.current = null
    setCard(emptyMedicalCard())
    setDeleteRequested(false)
    clearFeedback()
    setMode('locked')
  }

  function handleBack() {
    sessionRef.current = null
    setCard(emptyMedicalCard())
    setAccessCode('')
    setConfirmationCode('')
    onBack()
  }

  async function deleteCard() {
    if (!deleteRequested) {
      setDeleteRequested(true)
      return
    }
    try {
      await db.medicalCard.delete(MEDICAL_CARD_ID)
      sessionRef.current = null
      setCard(emptyMedicalCard())
      setDraft(emptyMedicalCard())
      setDeleteRequested(false)
      setMessage('La tarjeta y su respaldo cifrado fueron borrados de este dispositivo.')
      setMode('setup')
    } catch {
      setDeleteRequested(false)
      setError('No se pudo borrar la tarjeta del almacenamiento local.')
    }
  }

  async function exportCard() {
    clearFeedback()
    const record = await db.medicalCard.get(MEDICAL_CARD_ID)
    if (!record) {
      setError('No existe una tarjeta guardada para exportar.')
      return
    }
    const blob = new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'barrio24-tarjeta-cifrada.json'
    link.click()
    URL.revokeObjectURL(url)
    setMessage('Respaldo cifrado descargado. El código de acceso sigue siendo necesario para abrirlo.')
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    clearFeedback()
    try {
      const record = parseMedicalCardRecord(await file.text())
      await db.medicalCard.put(record)
      sessionRef.current = null
      setMode('locked')
      setMessage('Respaldo importado. Introduce su código de acceso para abrirlo.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo importar el respaldo.')
    }
  }

  function renderHeader(title: string, subtitle: string) {
    return (
      <header className="medical-header">
        <button className="back-link" type="button" onClick={handleBack}>
          <ArrowLeft size={17} aria-hidden="true" />
          Volver al inicio
        </button>
        <div className="medical-heading">
          <div className="eyebrow"><ShieldCheck size={15} aria-hidden="true" /> Tarjeta Médica Offline</div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
      </header>
    )
  }

  if (mode === 'loading') {
    return <div className="medical-shell"><div className="medical-loading" role="status">Revisando almacenamiento local…</div></div>
  }

  if (mode === 'setup') {
    return (
      <div className="medical-shell">
        {renderHeader('Tu información crítica, bajo tu control.', 'Crea una tarjeta breve para consultar sin conexión durante una emergencia.')}
        <main className="medical-main">
          <Notice>
            <strong>Privacidad primero.</strong> Esta información se guarda cifrada solo en este dispositivo. Barrio 24 no la envía a ningún servidor.
          </Notice>
          {error && <Notice tone="warning">{error}</Notice>}
          {message && <Notice tone="success">{message}</Notice>}
          <form className="medical-form" onSubmit={(event) => void handleCreate(event)}>
            <section className="medical-form-section" aria-labelledby="medical-data-title">
              <div className="form-section-heading">
                <p className="eyebrow">Solo lo necesario</p>
                <h2 id="medical-data-title">Información de emergencia</h2>
                <p>Evita incluir DNI, dirección, historia clínica completa u otra información que no sea útil en una emergencia.</p>
              </div>
              <div className="medical-fields">
                {fields.map((definition) => (
                  <Field key={definition.key} definition={definition} value={draft[definition.key]} onChange={(value) => updateDraft(definition.key, value)} />
                ))}
              </div>
            </section>
            <section className="medical-form-section" aria-labelledby="medical-code-title">
              <div className="form-section-heading">
                <p className="eyebrow">Cifrado local</p>
                <h2 id="medical-code-title">Protege la tarjeta</h2>
                <p>Usa un código que puedas recordar. Si lo pierdes, Barrio 24 no podrá recuperar la tarjeta.</p>
              </div>
              <div className="medical-code-grid">
                <AccessCodeField label="Código de acceso" value={accessCode} onChange={setAccessCode} autoFocus={false} />
                <AccessCodeField inputId="medical-access-code-confirmation" label="Repite el código" value={confirmationCode} onChange={setConfirmationCode} />
              </div>
            </section>
            <div className="medical-form-actions">
              <button className="button primary" type="submit" disabled={isSaving}>
                <LockKeyhole size={18} aria-hidden="true" />
                {isSaving ? 'Cifrando…' : 'Crear tarjeta cifrada'}
              </button>
              <button className="button secondary" type="button" onClick={() => importInputRef.current?.click()}>
                <Upload size={17} aria-hidden="true" />
                Importar respaldo
              </button>
              <input ref={importInputRef} className="visually-hidden" type="file" accept="application/json,.json" onChange={(event) => void handleImport(event)} />
            </div>
          </form>
        </main>
      </div>
    )
  }

  if (mode === 'locked') {
    return (
      <div className="medical-shell">
        {renderHeader('Abre tu tarjeta cuando la necesites.', 'El contenido permanece cifrado mientras la tarjeta está bloqueada.')}
        <main className="medical-main medical-centered-main">
          <section className="unlock-panel" aria-labelledby="unlock-title">
            <div className="unlock-icon"><LockKeyhole size={25} aria-hidden="true" /></div>
            <p className="eyebrow">Almacenamiento local</p>
            <h2 id="unlock-title">Tarjeta protegida</h2>
            <p>Introduce el código de acceso. No se envía a Barrio 24 ni se guarda en el navegador.</p>
            {error && <Notice tone="warning">{error}</Notice>}
            {message && <Notice tone="success">{message}</Notice>}
            <form onSubmit={(event) => void handleUnlock(event)}>
              <AccessCodeField label="Código de acceso" value={accessCode} onChange={setAccessCode} autoFocus />
              <button className="button primary full-width" type="submit" disabled={isSaving}>
                <LockKeyhole size={18} aria-hidden="true" />
                {isSaving ? 'Abriendo…' : 'Abrir tarjeta'}
              </button>
            </form>
            <div className="unlock-actions">
              <button className="text-button" type="button" onClick={() => importInputRef.current?.click()}>
                <Upload size={15} aria-hidden="true" /> Importar otro respaldo
              </button>
              <input ref={importInputRef} className="visually-hidden" type="file" accept="application/json,.json" onChange={(event) => void handleImport(event)} />
            </div>
          </section>
        </main>
      </div>
    )
  }

  if (mode === 'emergency') {
    const emergencyFields = fields.filter(({ key }) => Boolean(card[key].trim()))
    const visibleEmergencyFields = emergencyFields.filter(({ key }) => key !== 'nameOrAlias')
    return (
      <div className="medical-shell emergency-shell">
        <header className="emergency-header">
          <div>
            <p className="eyebrow">Vista para compartir</p>
            <h1>Información de emergencia</h1>
          </div>
          <button className="emergency-close" type="button" onClick={() => setMode('editing')}>
            <X size={20} aria-hidden="true" />
            Cerrar
          </button>
        </header>
        <main className="emergency-main">
          <div className="emergency-timer" role="status" aria-live="polite">
            <Eye size={17} aria-hidden="true" /> Esta vista se cerrará en {emergencySeconds} s
          </div>
          <section className="emergency-card" aria-labelledby="emergency-card-title">
            <div className="emergency-card-title">
              <h2 id="emergency-card-title">{card.nameOrAlias}</h2>
              <p>Información declarada por la persona titular</p>
            </div>
            <div className="emergency-fields">
              {visibleEmergencyFields.map((definition) => (
                <div className="emergency-field" key={definition.key}>
                  <span>{definition.label}</span>
                  <strong className="medical-value">{card[definition.key]}</strong>
                  {definition.key === 'bloodType' && <small>Autodeclarado; confirmar antes de usar.</small>}
                </div>
              ))}
            </div>
            {visibleEmergencyFields.length === 0 && <p className="emergency-empty">No hay más información registrada.</p>}
          </section>
          <p className="emergency-disclaimer">Esta tarjeta no reemplaza una evaluación médica. Verifica la información cuando sea posible.</p>
        </main>
      </div>
    )
  }

  return (
    <div className="medical-shell">
      {renderHeader('Tu tarjeta está lista.', 'Edita los datos cuando quieras; los cambios se guardan cifrados localmente.')}
      <main className="medical-main">
        <div className="medical-toolbar">
          <div className="local-status"><Check size={16} aria-hidden="true" /> Cifrada en este dispositivo</div>
          <div className="toolbar-actions">
            <button className="button secondary" type="button" onClick={() => setMode('emergency')}>
              <Eye size={17} aria-hidden="true" /> Mostrar 60 segundos
            </button>
            <button className="button secondary" type="button" onClick={() => void exportCard()}>
              <Download size={17} aria-hidden="true" /> Exportar respaldo
            </button>
            <button className="button secondary" type="button" onClick={lockCard}>
              <LockKeyhole size={17} aria-hidden="true" /> Bloquear
            </button>
          </div>
        </div>
        {error && <Notice tone="warning">{error}</Notice>}
        {message && <Notice tone="success">{message}</Notice>}
        <form className="medical-form" onSubmit={(event) => void handleSave(event)}>
          <section className="medical-form-section" aria-labelledby="edit-card-title">
            <div className="form-section-heading">
              <p className="eyebrow">Datos guardados localmente</p>
              <h2 id="edit-card-title">Revisa tu información</h2>
              <p>Comparte la vista de emergencia solo con quien deba ayudarte. La pantalla se cierra automáticamente.</p>
            </div>
            <div className="medical-fields">
              {fields.map((definition) => (
                <Field key={definition.key} definition={definition} value={card[definition.key]} onChange={(value) => updateCard(definition.key, value)} />
              ))}
            </div>
          </section>
          <div className="medical-form-actions">
            <button className="button primary" type="submit" disabled={isSaving}>
              <Save size={18} aria-hidden="true" />
              {isSaving ? 'Guardando…' : 'Guardar cambios cifrados'}
            </button>
          </div>
        </form>
        <section className="medical-danger-zone" aria-labelledby="delete-card-title">
          <div>
            <p className="eyebrow">Control de datos</p>
            <h2 id="delete-card-title">Borrar esta tarjeta</h2>
            <p>El borrado elimina el registro cifrado del dispositivo. Un respaldo descargado seguirá existiendo fuera de la aplicación.</p>
          </div>
          <button className="button danger" type="button" onClick={() => void deleteCard()}>
            <Trash2 size={17} aria-hidden="true" />
            {deleteRequested ? 'Pulsa otra vez para confirmar' : 'Borrar tarjeta'}
          </button>
        </section>
      </main>
    </div>
  )
}
