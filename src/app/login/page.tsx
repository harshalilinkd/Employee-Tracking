import { LoginForm } from '@/components/app/LoginForm'

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
        background: 'linear-gradient(160deg,#F3F4F9 0%,#E7EAF3 100%)',
        color: '#0A0A0A',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '22px',
        padding: '36px 24px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '980px',
          minHeight: '620px',
          display: 'flex',
          borderRadius: '22px',
          overflow: 'hidden',
          background: '#FFFFFF',
          boxShadow: '0 30px 80px rgba(10,10,10,0.18), 0 2px 8px rgba(10,10,10,0.06)',
          animation: 'epiIn 520ms cubic-bezier(0.2,0.8,0.2,1) both',
        }}
      >
        {/* Hero — hidden below 860px so the form gets the full sheet on mobile */}
        <section
          className="epi-login-hero"
          style={{
            flex: '0 0 44%',
            position: 'relative',
            background: 'linear-gradient(165deg,#12101F 0%,#0B0A14 60%,#0A0913 100%)',
            color: '#F5F4FB',
            padding: '40px 36px',
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
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', opacity: 0.55 }}
          >
            <path
              d="M330 -40 C 470 150, 500 330, 430 520 C 380 660, 420 720, 470 800"
              fill="none"
              stroke="rgba(14,124,107,0.28)"
              strokeWidth="1"
            />
            <path d="M392 -40 C 520 170, 546 350, 486 540" fill="none" stroke="rgba(14,124,107,0.18)" strokeWidth="1" />
            <path d="M-60 470 C 30 560, 40 660, -10 800" fill="none" stroke="rgba(14,124,107,0.20)" strokeWidth="1" />
            <circle cx="447" cy="196" r="2.5" fill="#14907c" />
            <circle cx="472" cy="284" r="2" fill="#14907c" opacity="0.7" />
          </svg>

          <div style={{ position: 'relative', display: 'flex', gap: '11px', alignItems: 'center' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg,#14907c 0%,#0e7c6b 55%,#0a5f52 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '15px',
                color: '#fff',
                boxShadow: '0 0 24px rgba(14,124,107,0.22)',
              }}
            >
              ET
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '-0.01em', lineHeight: 1.15 }}>
                Employee
              </span>
              <span
                style={{
                  fontSize: '13px',
                  fontWeight: 700,
                  letterSpacing: '-0.01em',
                  lineHeight: 1.15,
                  color: 'rgba(245,244,251,0.66)',
                }}
              >
                Tracking
              </span>
            </div>
          </div>

          <div style={{ position: 'relative' }}>
            <h1 style={{ margin: 0, fontSize: '30px', fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1.2 }}>
              Recognition and issues,
              <br />
              on the record.
            </h1>
            <p
              style={{
                margin: '14px 0 0',
                fontSize: '14px',
                lineHeight: 1.6,
                color: 'rgba(245,244,251,0.66)',
                maxWidth: '320px',
              }}
            >
              Every contribution and every goofup, attributed and dated — so a
              performance conversation rests on what actually happened.
            </p>
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
              color: 'rgba(245,244,251,0.6)',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '7px', whiteSpace: 'nowrap' }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '999px', background: '#14907c' }} />
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
          {params.error ? (
            <noscript />
          ) : null}
          <LoginForm next={next} />
        </section>
      </div>

      <p style={{ margin: 0, fontSize: '12px', color: '#1c1c1f' }}>
        LD Silk Mills · Internal performance system
      </p>

      <style
        dangerouslySetInnerHTML={{
          __html: `@media (max-width: 860px) { .epi-login-hero { display: none !important; } }`,
        }}
      />
    </div>
  )
}
