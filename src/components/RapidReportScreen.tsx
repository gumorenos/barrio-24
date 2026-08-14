import { useEffect, useState, type FormEvent } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Check,
  CircleAlert,
  CloudOff,
  CloudUpload,
  Droplets,
  Flame,
  HeartPulse,
  Home,
  MapPin,
  Package,
  PersonStanding,
  ShieldAlert,
  TrafficCone,
  UserRound,
  WifiOff,
  Zap,
} from 'lucide-react'
import { db } from '../lib/db'
import {
  createRapidReport,
  getApproximateLocationCell,
  getCategoryLabel,
  getRapidReportStatusLabel,
  getSeverityLabel,
  RAPID_REPORT_CATEGORIES,
  RAPID_REPORT_SEVERITIES,
  type RapidReport,
  type RapidReportCategory,
  type RapidReportSeverity,
} from '../lib/rapid-report'
import { formatTimestamp } from '../lib/outbox'
import { REPORTS_API_URL, syncLocalRapidReports } from '../lib/rapid-report-sync'

interface RapidReportScreenProps {
  onBack: () => void
}

type LocationStatus = 'not-requested' | 'requesting' | 'available' | 'unavailable'

const categoryIcons: Record<RapidReportCategory, typeof Activity> = {
  'injured-person': HeartPulse,
  'trapped-person': PersonStanding,
  'building-damage': Home,
  'fire-or-leak': Flame,
  'blocked-street': TrafficCone,
  'water-shortage': Droplets,
  'power-outage': Zap,
  'shelter-needed': ShieldAlert,
  'food-or-medicine': Package,
}

function Notice({ children, tone = 'info' }: { children: React.ReactNode; tone?: 'info' | 'warning' | 'success' }) {
  return <div className={`rapid-notice ${tone}`} role="status">{children}</div>
}

function reportLocationLabel(locationCell: string | null): string {
  return locationCell ? 'Zona aproximada guardada' : 'Sin ubicación'
}

export default function RapidReportScreen({ onBack }: RapidReportScreenProps) {
  const [category, setCategory] = useState<RapidReportCategory | null>(null)
  const [severity, setSeverity] = useState<RapidReportSeverity>('attention')
  const [locationCell, setLocationCell] = useState<string | null>(null)
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('not-requested')
  const [reports, setReports] = useState<RapidReport[]>([])
  const [totalReports, setTotalReports] = useState(0)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)

  async function refreshReports() {
    const [recent, total] = await Promise.all([
      db.rapidReports.orderBy('createdAt').reverse().limit(5).toArray(),
      db.rapidReports.count(),
    ])
    setReports(recent)
    setTotalReports(total)
  }

  useEffect(() => {
    void refreshReports().catch(() => setError('No se pudieron leer los reportes locales.'))
  }, [])

  function clearFeedback() {
    setError('')
    setMessage('')
  }

  function locationErrorMessage(error: GeolocationPositionError): string {
    switch (error.code) {
      case error.PERMISSION_DENIED:
        return 'Este navegador no tiene permiso para usar la ubicación. Revisa el permiso de ubicación del sitio y vuelve a intentarlo.'
      case error.POSITION_UNAVAILABLE:
        return 'El iPhone no pudo determinar una ubicación. Comprueba que Localización esté activa, prueba con Wi‑Fi o datos móviles y vuelve a intentarlo.'
      case error.TIMEOUT:
        return 'La ubicación tardó demasiado en responder. Mantén abierta esta página, espera unos segundos y vuelve a intentarlo.'
      default:
        return 'No se obtuvo la ubicación. Puedes guardar el reporte sin ella o volver a intentarlo.'
    }
  }

  function requestLocation() {
    clearFeedback()
    if (!navigator.geolocation) {
      setLocationStatus('unavailable')
      setError('Este navegador no ofrece ubicación. Puedes guardar el reporte sin ella.')
      return
    }
    if (!window.isSecureContext) {
      setLocationStatus('unavailable')
      setError('La ubicación solo funciona en una conexión segura. Abre el preview en Safari usando su dirección https://.')
      return
    }

    setLocationStatus('requesting')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        try {
          const cell = getApproximateLocationCell(position.coords.latitude, position.coords.longitude)
          setLocationCell(cell)
          setLocationStatus('available')
          setMessage('Se usará una zona aproximada; no se guardan tus coordenadas exactas.')
        } catch {
          setLocationStatus('unavailable')
          setError('No se pudo convertir la ubicación en una zona aproximada.')
        }
      },
      (positionError) => {
        setLocationStatus('unavailable')
        setError(locationErrorMessage(positionError))
      },
      { enableHighAccuracy: false, maximumAge: 300_000, timeout: 15_000 },
    )
  }

  function removeLocation() {
    setLocationCell(null)
    setLocationStatus('not-requested')
    setMessage('El reporte se guardará sin ubicación.')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    clearFeedback()
    if (!category) {
      setError('Selecciona qué situación observaste.')
      return
    }

    setIsSaving(true)
    try {
      const report = createRapidReport({ category, severity, locationCell })
      await db.rapidReports.put(report)
      await refreshReports()
      setCategory(null)
      setSeverity('attention')
      setLocationCell(null)
      setLocationStatus('not-requested')
      setMessage('Reporte guardado en este dispositivo. Todavía no se ha enviado ni publicado.')
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo guardar el reporte local.')
    } finally {
      setIsSaving(false)
    }
  }

  async function syncReports() {
    clearFeedback()
    if (!REPORTS_API_URL) {
      setError('La sincronización todavía no está configurada.')
      return
    }
    if (!navigator.onLine) {
      setError('Sin conexión: el reporte permanece guardado para reintentar después.')
      return
    }

    setIsSyncing(true)
    try {
      const summary = await syncLocalRapidReports()
      setMessage(summary.message)
      await refreshReports()
    } catch {
      setError('No se pudieron sincronizar los reportes. Siguen guardados localmente.')
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <div className="rapid-shell">
      <header className="rapid-header">
        <button className="back-link" type="button" onClick={onBack}>
          <ArrowLeft size={17} aria-hidden="true" />
          Volver al inicio
        </button>
        <div className="rapid-heading">
          <div className="eyebrow"><Activity size={15} aria-hidden="true" /> Reporte 60 segundos</div>
          <h1>Cuenta lo que estás viendo.</h1>
          <p>Un reporte breve puede ayudar a ordenar necesidades. Describe solo una situación observable.</p>
        </div>
      </header>

      <main className="rapid-main">
        <Notice>
          {REPORTS_API_URL ? (
            <><strong>Envío manual a API de prueba.</strong> Los reportes permanecen en este dispositivo hasta que elijas sincronizarlos. Un reporte recibido todavía no está verificado ni reemplaza a los servicios de emergencia.</>
          ) : (
            <><strong>Prototipo offline.</strong> Por ahora, el reporte se guarda únicamente en este dispositivo. No se publica, no se comparte y no reemplaza a los servicios de emergencia.</>
          )}
        </Notice>
        {error && <Notice tone="warning"><AlertTriangle size={16} aria-hidden="true" /> {error}</Notice>}
        {message && <Notice tone="success"><Check size={16} aria-hidden="true" /> {message}</Notice>}

        <form className="rapid-form" onSubmit={(event) => void handleSubmit(event)}>
          <section className="rapid-form-section" aria-labelledby="rapid-category-title">
            <div className="form-section-heading">
              <p className="eyebrow">Paso 1 de 3</p>
              <h2 id="rapid-category-title">¿Qué situación observaste?</h2>
              <p>Selecciona una sola categoría. No incluyas nombres, teléfonos ni información médica.</p>
            </div>
            <div className="rapid-category-grid">
              {RAPID_REPORT_CATEGORIES.map((item) => {
                const Icon = categoryIcons[item.id]
                const selected = category === item.id
                return (
                  <button
                    className={`rapid-category ${selected ? 'selected' : ''}`}
                    type="button"
                    key={item.id}
                    aria-pressed={selected}
                    onClick={() => { clearFeedback(); setCategory(item.id) }}
                  >
                    <span className="rapid-category-icon"><Icon size={20} aria-hidden="true" /></span>
                    <span className="rapid-category-copy"><strong>{item.label}</strong><small>{item.description}</small></span>
                    {selected && <Check className="rapid-category-check" size={18} aria-hidden="true" />}
                  </button>
                )
              })}
            </div>
          </section>

          <section className="rapid-form-section" aria-labelledby="rapid-severity-title">
            <div className="form-section-heading">
              <p className="eyebrow">Paso 2 de 3</p>
              <h2 id="rapid-severity-title">¿Qué tan urgente parece?</h2>
              <p>Es una percepción de quien reporta, no una clasificación profesional.</p>
            </div>
            <div className="rapid-severity-list" role="radiogroup" aria-label="Nivel de gravedad observado">
              {RAPID_REPORT_SEVERITIES.map((item) => (
                <label className={`rapid-severity ${severity === item.id ? 'selected' : ''}`} key={item.id}>
                  <input
                    type="radio"
                    name="rapid-severity"
                    value={item.id}
                    checked={severity === item.id}
                    onChange={() => setSeverity(item.id)}
                  />
                  <span className="rapid-severity-mark" aria-hidden="true" />
                  <span><strong>{item.label}</strong><small>{item.description}</small></span>
                </label>
              ))}
            </div>
          </section>

          <section className="rapid-form-section" aria-labelledby="rapid-location-title">
            <div className="form-section-heading">
              <p className="eyebrow">Paso 3 de 3 · opcional</p>
              <h2 id="rapid-location-title">Añade una zona aproximada</h2>
              <p>La ubicación ayuda a agrupar reportes. Se redondea antes de guardarse y nunca se conserva la coordenada exacta.</p>
            </div>
            <div className="rapid-location-row">
              <div className="rapid-location-status">
                <span className={`rapid-location-icon ${locationCell ? 'available' : ''}`}><MapPin size={19} aria-hidden="true" /></span>
                <span><strong>{reportLocationLabel(locationCell)}</strong><small>{locationCell ? 'Precisión aproximada de alrededor de 1 km.' : 'Puedes continuar sin compartir ubicación.'}</small></span>
              </div>
              <div className="rapid-location-actions">
                {locationCell ? (
                  <button className="button secondary" type="button" onClick={removeLocation}>Quitar ubicación</button>
                ) : (
                  <button className="button secondary" type="button" onClick={requestLocation} disabled={locationStatus === 'requesting'}>
                    <MapPin size={17} aria-hidden="true" />
                    {locationStatus === 'requesting' ? 'Buscando zona…' : 'Usar zona aproximada'}
                  </button>
                )}
              </div>
            </div>
          </section>

          <div className="rapid-submit-row">
            <div className="rapid-submit-note"><WifiOff size={17} aria-hidden="true" /><span>Funciona sin conexión. Se guardará localmente.</span></div>
            <div className="rapid-submit-actions">
              {REPORTS_API_URL && (
                <button className="button secondary" type="button" onClick={() => void syncReports()} disabled={isSyncing}>
                  <CloudUpload size={18} aria-hidden="true" />
                  {isSyncing ? 'Sincronizando…' : 'Sincronizar guardados'}
                </button>
              )}
              <button className="button primary" type="submit" disabled={isSaving}>
                <CloudOff size={18} aria-hidden="true" />
                {isSaving ? 'Guardando…' : 'Guardar reporte'}
              </button>
            </div>
          </div>
        </form>

        <section className="rapid-recent" aria-labelledby="rapid-recent-title">
          <div className="section-heading compact">
            <div>
              <p className="eyebrow">Solo en este dispositivo</p>
              <h2 id="rapid-recent-title">Reportes recientes</h2>
            </div>
            <span className="tiny-label">{reports.length === totalReports ? `${totalReports} guardado${totalReports === 1 ? '' : 's'}` : `${reports.length} de ${totalReports} recientes`}</span>
          </div>
          {reports.length === 0 ? (
            <div className="rapid-empty"><CircleAlert size={22} aria-hidden="true" /><p>Aquí aparecerán los reportes que guardes. No son visibles para otras personas.</p></div>
          ) : (
            <ul className="rapid-report-list">
              {reports.map((report) => (
                <li key={report.id}>
                  <span className="rapid-report-list-icon"><UserRound size={17} aria-hidden="true" /></span>
                  <span><strong>{getCategoryLabel(report.category)}</strong><small>{getSeverityLabel(report.severity)} · {formatTimestamp(report.createdAt)} · {reportLocationLabel(report.locationCell)}</small></span>
                  <span className="rapid-local-badge">{getRapidReportStatusLabel(report.status)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <footer className="footer">
        <span>Barrio 24 · reporte local</span>
        <span>{REPORTS_API_URL ? 'API de prueba · envío manual' : 'Sin API conectada · sin publicación'}</span>
      </footer>
    </div>
  )
}
