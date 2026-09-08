import Link from 'next/link'
import { AlertCircle, CalendarDays, ChevronRight, Lightbulb, Target, TrendingUp } from 'lucide-react'
import { cardStyle } from '@/lib/design'

export interface Insight {
  icon: 'alert' | 'calendar' | 'trend' | 'target'
  tone: 'red' | 'blue' | 'teal' | 'orange' | 'green'
  head: React.ReactNode
  sub: string
  href: string
}

/**
 * The "so what" column.
 *
 * Every line is assembled from a counted value and pairs the observation with
 * the action it implies — a dashboard that only reports numbers leaves the
 * reader to work out what to do about them.
 */
export function QuickInsights({ items }: { items: Insight[] }) {
  return (
    <section style={{ ...cardStyle, padding: '17px 19px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '11px', marginBottom: '14px' }}>
        <span
          style={{
            width: '30px',
            height: '30px',
            flex: '0 0 30px',
            borderRadius: '9px',
            background: 'var(--epi-teal-bg)',
            color: 'var(--epi-teal)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Lightbulb size={16} />
        </span>
        <h2 style={{ margin: 0, fontSize: '16px', fontWeight: 700, letterSpacing: '-0.015em' }}>Quick Insights</h2>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
        {items.map((ins, i) => (
          <Link
            key={i}
            href={ins.href}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px 13px',
              borderRadius: '11px',
              background: `var(--epi-${ins.tone}-bg)`,
              border: `1px solid var(--epi-${ins.tone}-bd)`,
              color: 'var(--epi-fg)',
              textDecoration: 'none',
            }}
          >
            <span
              style={{
                width: '30px',
                height: '30px',
                flex: '0 0 30px',
                borderRadius: '999px',
                background: 'var(--epi-surface)',
                color: `var(--epi-${ins.tone})`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {ins.icon === 'alert' ? (
                <AlertCircle size={15} />
              ) : ins.icon === 'calendar' ? (
                <CalendarDays size={15} />
              ) : ins.icon === 'trend' ? (
                <TrendingUp size={15} />
              ) : (
                <Target size={15} />
              )}
            </span>

            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: '13.5px', fontWeight: 600 }}>{ins.head}</span>
              <span style={{ display: 'block', fontSize: '12px', color: 'var(--epi-fg-2)', marginTop: '2px' }}>
                {ins.sub}
              </span>
            </span>

            <ChevronRight size={15} style={{ color: 'var(--epi-fg-3)', flex: '0 0 15px' }} />
          </Link>
        ))}
      </div>
    </section>
  )
}
