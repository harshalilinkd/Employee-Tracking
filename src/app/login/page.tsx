import { LoginForm } from '@/components/app/LoginForm'

/**
 * The hero used a near-black violet ground, which was the one screen in the
 * product that did not look like the product — the app's own sidebar is deep
 * teal. It now carries the same palette, so signing in and landing on the
 * dashboard read as one system rather than two.
 */

const HERO_POINTS = [
  'Contributions and goofups, dated and attributed',
  'A performance signal per employee, from recorded events only',
  'Printable reports for review and sign-off',
]

function Lockup({ dark }: { dark?: boolean }) {
  return (
    <div style={{ position: 'relative', display: 'flex', gap: '12px', alignItems: 'center' }}>
      <div
        style={{
          width: '42px',
          height: '42px',
          flex: '0 0 42px',
          borderRadius: '12px',
          background: 'linear-gradient(135deg,#14907c 0%,#0e7c6b 55%,#0a5f52 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 800,
          fontSize: '17px',
          letterSpacing: '0.01em',
          color: '#fff',
          boxShadow: dark ? '0 0 30px rgba(20,144,124,0.30)' : '0 6px 16px rgba(14,124,107,0.24)',
        }}
      >
        ET
      </div>
      {/* One line, not two stacked words — the system has a name, so it should
          read as a name. */}
      <span
        style={{
          fontSize: '22px',
          fontWeight: 700,
          letterSpacing: '-0.022em',
          lineHeight: 1.1,
          whiteSpace: 'nowrap',
          color: dark ? '#F2F7F5' : '#000000',
        }}
      >
        Employee{' '}
        <span style={{ fontWeight: 400, color: dark ? 'rgba(242,247,245,0.62)' : '#1a1a1a' }}>Tracking</span>
      </span>
    </div>
  )
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>
}) {
  const params = await searchParams
  const next = params.next && params.next.startsWith('/') ? params.next : '/'

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'radial-gradient(1200px 620px at 12% -10%, #dfeeea 0%, transparent 60%), linear-gradient(160deg,#f4f8fa 0%,#e4edf0 100%)',
        color: '#000000',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '20px',
        padding: '36px 20px',
      }}
    >
      <div
        className="epi-login-card"
        style={{
          width: '100%',
          maxWidth: '1000px',
          minHeight: '640px',
          display: 'flex',
          borderRadius: '24px',
          overflow: 'hidden',
          background: '#FFFFFF',
          border: '1px solid rgba(14,43,38,0.06)',
          boxShadow: '0 40px 90px rgba(6,38,32,0.20), 0 4px 12px rgba(6,38,32,0.06)',
          animation: 'epiIn 520ms cubic-bezier(0.2,0.8,0.2,1) both',
        }}
      >
        {/* Hero — hidden below 860px so the form gets the full sheet on mobile */}
        <section
          className="epi-login-hero"
          style={{
            flex: '0 0 46%',
            position: 'relative',
            background: 'linear-gradient(165deg,#0b3d34 0%,#072b25 58%,#04201b 100%)',
            color: '#F2F7F5',
            padding: '38px 36px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            overflow: 'hidden',
          }}
        >
          <svg
            viewBox="0 0 520 760"
            preserveAspectRatio="none"
            aria-hidden="true"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
          >
            <defs>
              <radialGradient id="epiGlow" cx="0.78" cy="0.14" r="0.62">
                <stop offset="0%" stopColor="#14907c" stopOpacity="0.30" />
                <stop offset="100%" stopColor="#14907c" stopOpacity="0" />
              </radialGradient>
            </defs>
            <rect width="520" height="760" fill="url(#epiGlow)" />
            <path
              d="M330 -40 C 470 150, 500 330, 430 520 C 380 660, 420 720, 470 800"
              fill="none"
              stroke="rgba(120,222,201,0.24)"
              strokeWidth="1"
            />
            <path d="M392 -40 C 520 170, 546 350, 486 540" fill="none" stroke="rgba(120,222,201,0.14)" strokeWidth="1" />
            <path d="M-60 470 C 30 560, 40 660, -10 800" fill="none" stroke="rgba(120,222,201,0.16)" strokeWidth="1" />
            <circle cx="447" cy="196" r="2.5" fill="#4fc3a8" />
            <circle cx="472" cy="284" r="2" fill="#4fc3a8" opacity="0.65" />
          </svg>

          <Lockup dark />

          <div style={{ position: 'relative' }}>
            <h1 style={{ margin: 0, fontSize: '34px', fontWeight: 700, letterSpacing: '-0.032em', lineHeight: 1.14 }}>
              Recognition and issues,
              <br />
              on the record.
            </h1>
            <p
              style={{
                margin: '15px 0 0',
                fontSize: '14.5px',
                lineHeight: 1.62,
                color: 'rgba(242,247,245,0.68)',
                maxWidth: '330px',
              }}
            >
              Every contribution and every goofup, attributed and dated — so a
              performance conversation rests on what actually happened.
            </p>

            {/* What the system actually does, so the panel says something
                beyond the headline. */}
            <ul
              style={{
                listStyle: 'none',
                margin: '24px 0 0',
                padding: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: '11px',
                maxWidth: '330px',
              }}
            >
              {HERO_POINTS.map((point) => (
                <li
                  key={point}
                  style={{
                    display: 'flex',
                    gap: '11px',
                    alignItems: 'flex-start',
                    fontSize: '13.5px',
                    lineHeight: 1.45,
                    color: 'rgba(242,247,245,0.80)',
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: '18px',
                      height: '18px',
                      flex: '0 0 18px',
                      marginTop: '1px',
                      borderRadius: '999px',
                      background: 'rgba(79,195,168,0.16)',
                      border: '1px solid rgba(79,195,168,0.34)',
                      color: '#4fc3a8',
                      fontSize: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    ✓
                  </span>
                  {point}
                </li>
              ))}
            </ul>
          </div>

          <div
            style={{
              position: 'relative',
              display: 'flex',
              gap: '14px',
              flexWrap: 'wrap',
              alignItems: 'center',
              fontFamily: 'var(--font-mono), monospace',
              fontSize: '11px',
              color: 'rgba(242,247,245,0.58)',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '7px', whiteSpace: 'nowrap' }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '999px', background: '#4fc3a8' }} />
              LD Silk Mills
            </span>
            <span style={{ whiteSpace: 'nowrap' }}>Internal use only</span>
          </div>
        </section>

        <section
          style={{
            flex: 1,
            background: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px 32px',
          }}
        >
          {params.error ? <noscript /> : null}

          <div style={{ width: '100%', maxWidth: '364px' }}>
            {/* With the hero panel gone on a phone the product had no name on
                screen at all, so the lockup comes back above the form. */}
            <div className="epi-login-brand" style={{ marginBottom: '28px' }}>
              <Lockup />
            </div>
            <LoginForm next={next} />
          </div>
        </section>
      </div>

      <p style={{ margin: 0, fontSize: '12px', color: '#1a1a1a' }}>
        LD Silk Mills · Internal performance system
      </p>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            .epi-login-brand { display: none; }
            @media (max-width: 860px) {
              .epi-login-hero { display: none !important; }
              .epi-login-brand { display: block; }
              .epi-login-card { min-height: 0 !important; border-radius: 20px !important; }
            }
            @media (max-width: 520px) {
              .epi-login-card > section { padding: 30px 20px !important; }
            }
          `,
        }}
      />
    </div>
  )
}
