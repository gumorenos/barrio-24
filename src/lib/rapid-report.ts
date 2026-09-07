export const RAPID_REPORT_SCHEMA_VERSION = 1

export const RAPID_REPORT_CATEGORIES = [
  {
    id: 'injured-person',
    label: 'Persona herida',
    description: 'Alguien necesita atención o ayuda inmediata.',
  },
  {
    id: 'trapped-person',
    label: 'Persona atrapada',
    description: 'Alguien no puede salir por sus propios medios.',
  },
  {
    id: 'building-damage',
    label: 'Edificio dañado',
    description: 'Daño visible en una vivienda, local o estructura.',
  },
  {
    id: 'fire-or-leak',
    label: 'Incendio o fuga',
    description: 'Fuego, humo, fuga de gas o agua peligrosa.',
  },
  {
    id: 'blocked-street',
    label: 'Calle bloqueada',
    description: 'Una vía no puede utilizarse con normalidad.',
  },
  {
    id: 'water-shortage',
    label: 'Falta de agua',
    description: 'Interrupción o necesidad visible de agua.',
  },
  {
    id: 'power-outage',
    label: 'Corte eléctrico',
    description: 'Interrupción del servicio eléctrico en la zona.',
  },
  {
    id: 'shelter-needed',
    label: 'Necesidad de refugio',
    description: 'Una persona o familia necesita un lugar seguro.',
  },
  {
    id: 'food-or-medicine',
    label: 'Alimentos o medicinas',
    description: 'Necesidad puntual de suministros esenciales.',
  },
] as const

export type RapidReportCategory = (typeof RAPID_REPORT_CATEGORIES)[number]['id']
export type RapidReportSeverity = 'observed' | 'attention' | 'immediate-risk'
export type RapidReportStatus = 'local-only' | 'pending' | 'unverified' | 'sync-failed'

export const RAPID_REPORT_SEVERITIES: Array<{
  id: RapidReportSeverity
  label: string
  description: string
}> = [
  {
    id: 'observed',
    label: 'Situación observada',
    description: 'Está ocurriendo, pero no parece requerir atención inmediata.',
  },
  {
    id: 'attention',
    label: 'Requiere atención',
    description: 'La situación necesita apoyo pronto.',
  },
  {
    id: 'immediate-risk',
    label: 'Riesgo inmediato',
    description: 'Hay peligro actual para personas o estructuras.',
  },
]

export interface RapidReport {
  id: string
  schemaVersion: number
  category: RapidReportCategory
  severity: RapidReportSeverity
  locationCell: string | null
  createdAt: number
  status: RapidReportStatus
}

export const RAPID_REPORT_EXPORT_VERSION = 1

export function serializeRapidReports(reports: RapidReport[], exportedAt = new Date().toISOString()): string {
  if (!Number.isFinite(Date.parse(exportedAt))) {
    throw new Error('La fecha de exportación no es válida.')
  }

  return JSON.stringify({
    export_version: RAPID_REPORT_EXPORT_VERSION,
    exported_at: exportedAt,
    reports: reports.map((report) => ({
      event_id: report.id,
      schema_version: report.schemaVersion,
      category: report.category,
      severity: report.severity,
      location_cell: report.locationCell,
      observed_at: new Date(report.createdAt).toISOString(),
      status: report.status,
    })),
  }, null, 2)
}

export function getCategoryLabel(category: RapidReportCategory): string {
  return RAPID_REPORT_CATEGORIES.find((item) => item.id === category)?.label ?? category
}

export function getSeverityLabel(severity: RapidReportSeverity): string {
  return RAPID_REPORT_SEVERITIES.find((item) => item.id === severity)?.label ?? severity
}

export function getRapidReportStatusLabel(status: RapidReportStatus): string {
  if (status === 'pending') return 'Enviando…'
  if (status === 'unverified') return 'Recibido · no verificado'
  if (status === 'sync-failed') return 'Pendiente de reintento'
  return 'Solo en este dispositivo'
}

export function getApproximateLocationCell(latitude: number, longitude: number, gridSize = 0.01): string {
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    throw new Error('La latitud no es válida.')
  }
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    throw new Error('La longitud no es válida.')
  }
  if (!Number.isFinite(gridSize) || gridSize <= 0) {
    throw new Error('La precisión de ubicación no es válida.')
  }

  const roundedLatitude = Math.round(latitude / gridSize) * gridSize
  const roundedLongitude = Math.round(longitude / gridSize) * gridSize
  const decimals = Math.max(0, Math.ceil(Math.log10(1 / gridSize)))
  const format = (value: number) => (Object.is(value, -0) ? 0 : value).toFixed(decimals)
  return `${format(roundedLatitude)},${format(roundedLongitude)}`
}

export function createRapidReport(
  input: {
    category: RapidReportCategory
    severity: RapidReportSeverity
    locationCell?: string | null
  },
  now = Date.now(),
  id = crypto.randomUUID(),
): RapidReport {
  if (!RAPID_REPORT_CATEGORIES.some((item) => item.id === input.category)) {
    throw new Error('Selecciona una categoría para el reporte.')
  }
  if (!RAPID_REPORT_SEVERITIES.some((item) => item.id === input.severity)) {
    throw new Error('Selecciona el nivel de gravedad observado.')
  }
  if (!Number.isSafeInteger(now) || now <= 0) {
    throw new Error('La fecha del reporte no es válida.')
  }
  if (!id) {
    throw new Error('El reporte necesita un identificador.')
  }

  return {
    id,
    schemaVersion: RAPID_REPORT_SCHEMA_VERSION,
    category: input.category,
    severity: input.severity,
    locationCell: input.locationCell ?? null,
    createdAt: now,
    status: 'local-only',
  }
}

export function isRapidReport(value: unknown): value is RapidReport {
  if (!value || typeof value !== 'object') return false
  const report = value as Partial<RapidReport>
  return typeof report.id === 'string'
    && report.id.length > 0
    && report.schemaVersion === RAPID_REPORT_SCHEMA_VERSION
    && typeof report.category === 'string'
    && RAPID_REPORT_CATEGORIES.some((item) => item.id === report.category)
    && typeof report.severity === 'string'
    && RAPID_REPORT_SEVERITIES.some((item) => item.id === report.severity)
    && (typeof report.locationCell === 'string' || report.locationCell === null)
    && typeof report.createdAt === 'number'
    && Number.isSafeInteger(report.createdAt)
    && report.createdAt > 0
    && (report.status === 'local-only'
      || report.status === 'pending'
      || report.status === 'unverified'
      || report.status === 'sync-failed')
}
