import { pill, signalTone } from '@/lib/design'

/**
 * SPEC §5: "If the UI cannot explain why an employee is marked Attention,
 * the badge does not ship." The explanation comes from the signal view as
 * plain English and is exposed here as a native tooltip, so it is available
 * on hover, on focus and to screen readers.
 */
export function SignalBadge({
  band,
  explanation,
  size = 'sm',
}: {
  band: string
  explanation?: string
  size?: 'sm' | 'lg'
}) {
  const tone = signalTone(band)
  const base = pill(tone)

  if (size === 'lg') {
    return (
      <span
        title={explanation}
        tabIndex={explanation ? 0 : undefined}
        style={{
          ...base,
          fontSize: '15px',
          letterSpacing: '-0.01em',
          textTransform: 'none',
          padding: '6px 12px',
          borderRadius: '8px',
          display: 'inline-block',
          marginTop: '8px',
        }}
      >
        {band}
      </span>
    )
  }

  return (
    <span title={explanation} tabIndex={explanation ? 0 : undefined} style={base}>
      {band}
    </span>
  )
}
