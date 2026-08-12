# Dirección visual de Barrio 24

## Objetivo

Crear una interfaz que transmita calma, claridad y confianza durante una situación de estrés. Barrio 24 debe parecer una herramienta pública cuidadosamente diseñada, no una plantilla genérica producida por IA.

## Principios

1. Una acción primaria por pantalla.
2. Lenguaje directo, sin marketing ni alarmismo.
3. Información oficial, reportes ciudadanos y datos no verificados siempre diferenciados.
4. Estado de conexión y sincronización visible.
5. Accesibilidad desde el primer componente.
6. La interfaz debe seguir siendo útil con poca batería, mala señal y pantallas pequeñas.

## Dirección gráfica

- Fondo claro y sobrio.
- Azul petróleo para estructura y confianza.
- Azul vivo para acciones primarias.
- Verde para confirmaciones.
- Ámbar para pendientes y advertencias.
- Rojo reservado para riesgo o necesidad urgente; no usarlo como color de marca.
- Tipografía de sistema para evitar dependencia de una red externa y conservar una carga rápida offline.
- Bordes discretos, radios moderados y sombras limitadas.
- Sin gradientes decorativos, glassmorphism, neón, blobs, fondos abstractos ni animaciones que distraigan.
- Iconos siempre acompañados por texto en acciones críticas.

## Componentes prioritarios

- Indicador de conectividad.
- Estado de sincronización.
- Botón primario grande.
- Mensaje de confirmación persistente.
- Mensaje de error accionable.
- Tarjeta de información oficial.
- Reporte ciudadano no verificado.
- Estado vacío que explica qué hacer.
- Vista de emergencia de alto contraste.

## Accesibilidad

- Objetivos táctiles de al menos 44 × 44 px.
- Contraste WCAG AA como mínimo.
- No depender exclusivamente del color.
- Foco visible por teclado.
- Etiquetas para lectores de pantalla.
- Texto ampliable sin romper el layout.
- Animaciones respetan `prefers-reduced-motion`.
- No usar mapas como único medio para comunicar una instrucción.

## Criterio de revisión visual

Antes de integrar una pantalla se revisará en:

- Android de gama media.
- iPhone con pantalla pequeña.
- Escritorio de ancho amplio.
- Modo offline.
- Tamaño de texto aumentado.
- Navegación por teclado.

