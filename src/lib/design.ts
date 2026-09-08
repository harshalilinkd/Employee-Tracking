import type { CSSProperties } from 'react'

/**
 * Style helpers ported from the design canvas.
 *
 * The canvas computed rgba() tints from hex at runtime via tint(hex, a).
 * Here the tints are pre-declared as CSS variables (see globals.css) so
 * every value follows the active theme without React needing to know
 * which theme is on — which also means these helpers stay pure and work
 * unchanged in Server Components.
 */

export type Tone =
  | 'pos'
  | 'neg'
  | 'warn'
  | 'accent'
  | 'muted'
  | 'green'
  | 'orange'
  | 'red'
  | 'teal'
  | 'blue'
  | 'violet'

export type SignalBand = 'Strong' | 'Stable' | 'Watch' | 'Attention' | 'No signal'

/**
 * Signal colours, per the dashboard reference: Strong reads green, Watch
 * amber, Attention red. Stable gets blue rather than grey so it is visibly
 * different from "No signal", which genuinely means we know nothing.
 */
export function signalTone(band: string): Tone {
  if (band === 'Strong') return 'green'
  if (band === 'Attention') return 'red'
  if (band === 'Watch') return 'orange'
  if (band === 'Stable') return 'blue'
  return 'muted'
}

export function toneVar(tone: Tone): string {
  if (tone === 'muted') return 'var(--epi-fg-3)'
  return `var(--epi-${tone})`
}

/** canvas: pill(color) */
export function pill(tone: Tone): CSSProperties {
  if (tone === 'muted') {
    return {
      fontSize: '10px',
      fontWeight: 700,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      padding: '4px 8px',
      borderRadius: '5px',
      color: 'var(--epi-fg-3)',
      background: 'var(--epi-track)',
      border: '1px solid var(--epi-border)',
      whiteSpace: 'nowrap',
      textAlign: 'center',
    }
  }
  return {
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    padding: '4px 8px',
    borderRadius: '5px',
    color: `var(--epi-${tone})`,
    background: `var(--epi-${tone}-bg)`,
    border: `1px solid var(--epi-${tone}-bd)`,
    whiteSpace: 'nowrap',
    textAlign: 'center',
  }
}

/** canvas: iconStyle(type) */
export function iconStyle(type: 'positive' | 'goofup'): CSSProperties {
  const tone = type === 'positive' ? 'pos' : 'neg'
  return {
    width: '24px',
    height: '24px',
    flex: '0 0 24px',
    borderRadius: '7px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    color: `var(--epi-${tone})`,
    background: `var(--epi-${tone}-bg)`,
    border: `1px solid var(--epi-${tone}-bd)`,
  }
}

/** canvas: chevStyle() */
export const chevStyle: CSSProperties = {
  width: '24px',
  height: '24px',
  flex: '0 0 24px',
  borderRadius: '7px',
  background: 'var(--epi-input)',
  border: '1px solid var(--epi-border)',
  color: 'var(--epi-fg-2)',
  fontSize: '11px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
}

export function avatarStyle(size = 30): CSSProperties {
  return {
    width: `${size}px`,
    height: `${size}px`,
    flex: `0 0 ${size}px`,
    borderRadius: '999px',
    background: 'var(--epi-raised)',
    border: '1px solid var(--epi-border-2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: size >= 40 ? '15px' : '11px',
    fontWeight: 700,
  }
}

export const cardStyle: CSSProperties = {
  border: '1px solid var(--epi-border)',
  borderRadius: '14px',
  background: 'var(--epi-surface)',
  boxShadow: 'var(--epi-shadow-card)',
}

export const primaryButton: CSSProperties = {
  height: '36px',
  padding: '0 14px',
  borderRadius: '8px',
  border: 0,
  background: 'linear-gradient(135deg,#14907c 0%,#0e7c6b 55%,#0a5f52 100%)',
  color: '#fff',
  fontSize: '14px',
  fontWeight: 600,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '7px',
}

export const subtleButton: CSSProperties = {
  height: '34px',
  padding: '0 13px',
  borderRadius: '8px',
  background: 'var(--epi-input)',
  border: '1px solid var(--epi-border-2)',
  color: 'var(--epi-fg)',
  fontSize: '13.5px',
  fontWeight: 600,
  cursor: 'pointer',
  // Without these an icon child wraps onto its own line above the label.
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '7px',
  whiteSpace: 'nowrap',
  flex: '0 0 auto',
}

export const inputStyle: CSSProperties = {
  height: '38px',
  borderRadius: '8px',
  background: 'var(--epi-input)',
  border: '1px solid var(--epi-border-2)',
  color: 'var(--epi-fg)',
  fontSize: '14px',
  padding: '0 12px',
  outline: 'none',
  width: '100%',
}

export const selectStyle: CSSProperties = {
  height: '34px',
  borderRadius: '8px',
  background: 'var(--epi-input)',
  border: '1px solid var(--epi-border)',
  color: 'var(--epi-fg)',
  fontSize: '13px',
  padding: '0 8px',
}

export const labelCaps: CSSProperties = {
  fontSize: '11px',
  fontWeight: 700,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: 'var(--epi-fg-3)',
}

export const tableHeadStyle: CSSProperties = {
  fontSize: '11px',
  fontWeight: 800,
  letterSpacing: '0.07em',
  textTransform: 'uppercase',
  color: 'var(--epi-fg-2)',
}

export const h1Style: CSSProperties = {
  margin: 0,
  fontSize: '28px',
  fontWeight: 700,
  letterSpacing: '-0.02em',
}

export const h2Style: CSSProperties = {
  margin: 0,
  fontSize: '18px',
  fontWeight: 700,
  letterSpacing: '-0.018em',
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return (parts[0] ?? '?').slice(0, 2).toUpperCase()
  return ((parts[0]?.[0] ?? '') + (parts[parts.length - 1]?.[0] ?? '')).toUpperCase()
}

/* =====================================================================
   Chart palette
   The two semantic colours are fixed: recognition is violet, issues are
   amber — they mean something and must not drift between charts.
   Everything categorical gets a genuinely distinct hue, because four
   shades of the same violet is decoration, not information.
   ===================================================================== */

/**
 * Chart hues are one set shared by both themes, because they end up in SVG
 * stroke/fill attributes where CSS variables do not resolve. They are held
 * a few steps below full saturation so they stay calm on the dark canvas
 * without washing out on white.
 */
export const CHART = {
  recognition: { from: '#A7DCC9', to: '#16a37a', solid: '#16a37a' },
  issues: { from: '#EBD5A3', to: '#D2A34A', solid: '#D2A34A' },
  accent: '#0e7c6b',

  /** Impact escalates cool -> hot, matching the Impact Mix legend. */
  impact: {
    low: '#57A9BC',
    medium: '#2f6fd0',
    high: '#D2A34A',
    critical: '#D0655E',
  } as Record<string, string>,

  /** Categorical series, ordered for maximum adjacent contrast. */
  series: [
    '#0e7c6b',
    '#57A9BC',
    '#D2A34A',
    '#4E9E6F',
    '#D0655E',
    '#6d5ce0',
    '#7099C9',
    '#C98A55',
    '#C77BA0',
  ] as string[],
}

/**
 * Dashboard-only palette, matching the printed report document.
 *
 * Kept separate from CHART so the rest of the app keeps its violet identity:
 * only the dashboard adopts the report's teal/green scheme.
 */
export const DASH = {
  /**
   * Chart colours as CSS variables, not hex, so the dashboard follows the
   * theme. Hardcoded light-mode hex was the reason dark mode looked harsh:
   * a colour picked to sit on white is far too hot on near-black.
   *
   * These reach SVG through the `style` property rather than the `stroke` /
   * `stopColor` attributes, because presentation attributes do not resolve
   * var().
   */
  teal: 'var(--epi-teal)',
  recognition: 'var(--epi-green)',
  issues: 'var(--epi-orange)',
  accent: 'var(--epi-teal)',
  impact: {
    low: 'var(--epi-green)',
    medium: 'var(--epi-blue)',
    high: 'var(--epi-orange)',
    critical: 'var(--epi-red)',
  } as Record<string, string>,
  series: [
    'var(--epi-violet)',
    'var(--epi-blue)',
    'var(--epi-orange)',
    'var(--epi-green)',
    'var(--epi-red)',
    'var(--epi-teal)',
  ],
}

export function seriesColour(i: number): string {
  return CHART.series[i % CHART.series.length] as string
}
