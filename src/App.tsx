import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Activity,
  Check,
  Clock3,
  Download,
  Globe2,
  MapPinned,
  Plus,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  UsersRound,
  Wifi,
  WifiOff,
} from 'lucide-react'
import MedicalCardScreen from './components/MedicalCardScreen'
import RapidReportScreen from './components/RapidReportScreen'
import { db, type OutboxEvent } from './lib/db'
import { createFoundationEvent, formatTimestamp, statusLabel } from './lib/outbox'

type ConnectionState = 'online' | 'offline'

const modules = [
  {
    icon: ShieldCheck,
    label: 'Tarjeta Médica',
    description: 'Tu información crítica, guardada en el dispositivo.',
    state: 'Disponible',
  },
  {
    icon: Activity,
    label: 'Reporte 60 segundos',
    description: 'Registra una situación observable con pocos pasos.',
    state: 'Disponible',
  },
  {
    icon: MapPinned,
    label: 'Ruta Alta',
    description: 'Mapas de evacuación disponibles sin conexión.',
    state: 'Próximamente',
  },
  {
    icon: UsersRound,
    label: 'Barrio 24',
    description: 'Coordina a tu familia, edificio o comunidad.',
    state: 'Próximamente',
  },
] as const

function getConnectionState(): ConnectionState {
  return navigator.onLine ? 'online' : 'offline'
}

function App() {
  const [connection, setConnection] = useState<ConnectionState>(getConnectionState)
  const [events, setEvents] = useState<OutboxEvent[]>([])
  const [lastSync, setLastSync] = useState<string | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [notice, setNotice] = useState('')
  const [activeView, setActiveView] = useState<'home' | 'medical' | 'rapid-report'>('home')

  const refreshLocalState = useCallback(async () => {
    const [nextEvents, syncMeta] = await Promise.all([
      db.outbox.orderBy('createdAt').reverse().toArray(),
      db.meta.get('last-sync'),
    ])
    setEvents(nextEvents)
    setLastSync(syncMeta?.value ?? null)
  }, [])

  useEffect(() => {
    void refreshLocalState()

    const goOnline = () => setConnection('online')
    const goOffline = () => setConnection('offline')
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)

    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || ('standalone' in window.navigator && Boolean(window.navigator.standalone))
    setIsInstalled(standalone)

    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [refreshLocalState])

  const pendingEvents = useMemo(
    () => events.filter((event) => event.status === 'pending').length,
    [events],
  )

  async function addSyntheticEvent() {
    await db.outbox.add(createFoundationEvent())
    setNotice('Operación guardada localmente. Todavía no se envía a ningún servidor.')
    await refreshLocalState()
  }

  async function simulateSync() {
    if (connection === 'offline') {
      setNotice('Sin conexión: la cola local se conserva para más tarde.')
      return
    }

    const pending = await db.outbox.where('status').equals('pending').toArray()
    if (pending.length === 0) {
      setNotice('No hay operaciones pendientes en la cola local.')
      return
    }

    await db.transaction('rw', db.outbox, db.meta, async () => {
      await Promise.all(pending.map((event) => db.outbox.update(event.id, {
        status: 'simulated',
        attempts: event.attempts + 1,
      })))
      await db.meta.put({ key: 'last-sync', value: String(Date.now()) })
    })

    setNotice('Demostración completada: las operaciones quedaron marcadas localmente. El API aún no está conectado.')
    await refreshLocalState()
  }

  if (activeView === 'medical') {
    return <MedicalCardScreen onBack={() => setActiveView('home')} />
  }

  if (activeView === 'rapid-report') {
    return <RapidReportScreen onBack={() => setActiveView('home')} />
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Barrio 24, inicio">
          <span className="brand-mark" aria-hidden="true">24</span>
          <span>
            <strong>Barrio 24</strong>
            <small>comunidad preparada</small>
          </span>
        </a>
        <div className={`connection-pill ${connection}`} role="status" aria-live="polite">
          {connection === 'online' ? <Wifi size={16} aria-hidden="true" /> : <WifiOff size={16} aria-hidden="true" />}
          <span>{connection === 'online' ? 'Con conexión' : 'Sin conexión'}</span>
        </div>
      </header>

      <main>
        <section className="hero" aria-labelledby="hero-title">
          <div className="eyebrow"><span className="eyebrow-dot" /> Fase 2 · captura offline</div>
          <div className="hero-grid">
            <div>
              <h1 id="hero-title">Cuando la conexión falla, la preparación permanece.</h1>
              <p className="hero-copy">
                Barrio 24 está construyendo herramientas sencillas para que las personas puedan
                prepararse, orientarse y coordinarse antes y después de una emergencia.
              </p>
              <div className="hero-actions">
                <button className="button primary" type="button" onClick={() => void addSyntheticEvent()}>
                  <Plus size={18} aria-hidden="true" />
                  Guardar prueba local
                </button>
                <button className="button secondary" type="button" onClick={() => void simulateSync()}>
                  <RefreshCw size={17} aria-hidden="true" />
                  Probar sincronización
                </button>
              </div>
              {notice && <p className="notice" role="status">{notice}</p>}
            </div>
            <aside className="hero-note" aria-label="Estado de la captura offline">
              <div className="note-icon"><ShieldCheck size={22} aria-hidden="true" /></div>
              <p className="note-kicker">Hito verificable</p>
              <p className="note-title">La información queda en el dispositivo mientras no hay API.</p>
              <p className="note-body">La tarjeta médica y los reportes locales aún no se envían ni se publican.</p>
            </aside>
          </div>
        </section>

        <section className="status-strip" aria-label="Estado local de la aplicación">
          <div className="status-item">
            <span className="status-icon blue"><Download size={17} aria-hidden="true" /></span>
            <span><strong>{isInstalled ? 'Instalada como PWA' : 'Lista para instalar'}</strong><small>una aplicación, varios dispositivos</small></span>
          </div>
          <div className="status-item">
            <span className="status-icon amber"><Clock3 size={17} aria-hidden="true" /></span>
            <span><strong>{pendingEvents} pendiente{pendingEvents === 1 ? '' : 's'}</strong><small>en la cola local</small></span>
          </div>
          <div className="status-item">
            <span className="status-icon green"><Check size={17} aria-hidden="true" /></span>
            <span><strong>{lastSync ? formatTimestamp(Number(lastSync)) : 'Aún no ejecutada'}</strong><small>última demo local</small></span>
          </div>
        </section>

        <section className="section" aria-labelledby="modules-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Lo que viene</p>
              <h2 id="modules-title">Cuatro herramientas, una misma idea</h2>
            </div>
            <p className="section-intro">Cada módulo tendrá una función concreta. Ninguno reemplaza a las autoridades ni a los servicios de emergencia.</p>
          </div>
          <div className="module-grid">
            {modules.map(({ icon: Icon, label, description, state }) => {
              const content = (
                <>
                  <div className="module-icon"><Icon size={21} aria-hidden="true" /></div>
                  <div className="module-content">
                    <div className="module-title-row"><h3>{label}</h3><span className="module-state">{state}</span></div>
                    <p>{description}</p>
                  </div>
                </>
              )

              return label === 'Tarjeta Médica' ? (
                <button className="module-card module-card-action" key={label} type="button" onClick={() => setActiveView('medical')}>
                  {content}
                </button>
              ) : label === 'Reporte 60 segundos' ? (
                <button className="module-card module-card-action" key={label} type="button" onClick={() => setActiveView('rapid-report')}>
                  {content}
                </button>
              ) : (
                <article className="module-card" key={label}>
                  {content}
                </article>
              )
            })}
          </div>
        </section>

        <section className="section lower-grid" aria-labelledby="queue-title">
          <div className="queue-panel">
            <div className="section-heading compact">
              <div>
                <p className="eyebrow">Persistencia local</p>
                <h2 id="queue-title">Cola de demostración</h2>
              </div>
              <span className="tiny-label">IndexedDB</span>
            </div>
            {events.length === 0 ? (
              <div className="empty-state"><Globe2 size={24} aria-hidden="true" /><p>Aún no hay operaciones. Guarda una prueba para ver cómo funciona la outbox.</p></div>
            ) : (
              <ul className="event-list">
                {events.map((event) => (
                  <li key={event.id}>
                    <span className={`event-dot ${event.status}`} aria-hidden="true" />
                    <span><strong>{statusLabel(event.status)}</strong><small>{formatTimestamp(event.createdAt)} · {event.id.slice(0, 8)}</small></span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <aside className="install-panel" aria-labelledby="install-title">
            <div className="install-icon"><Smartphone size={21} aria-hidden="true" /></div>
            <p className="eyebrow">Una sola aplicación</p>
            <h2 id="install-title">Navegador, Android e iPhone</h2>
            <p>Esta base se instala como PWA. Primero validaremos la experiencia offline; las aplicaciones nativas de las tiendas se evaluarán después.</p>
          </aside>
        </section>
      </main>

      <footer className="footer">
        <span>Barrio 24 · planificación inicial</span>
        <span>Datos sintéticos · sin API conectada</span>
      </footer>
    </div>
  )
}

export default App
