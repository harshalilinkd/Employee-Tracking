/**
 * Postgres speaks to the database administrator. This translates it for the
 * person who was trying to get work done.
 *
 * The case that prompted this: a signed-out browser reaches PostgREST as the
 * anonymous role, which has no USAGE on our schema, so every save failed with
 * "permission denied for schema employee_tracking". That is not a permission
 * problem the reader can do anything about — it means their sign-in lapsed —
 * and the sentence told them neither fact.
 *
 * Pages keep rendering in that state because they are drawn on the server
 * from the cookie, while writes go straight from the browser. So the app
 * looks signed in right up until the moment you try to save something.
 */

export interface WriteFailure {
  /** What to show the user. */
  message: string
  /** True when the only remedy is to sign in again. */
  signedOut: boolean
}

const SIGNED_OUT = [
  'permission denied for schema',
  'jwt expired',
  'jwt is expired',
  'invalid claim',
  'no api key found',
  'invalid authentication credentials',
]

export function describeWriteError(raw: string | null | undefined): WriteFailure {
  const text = (raw ?? '').toLowerCase()

  if (SIGNED_OUT.some((m) => text.includes(m))) {
    return {
      message:
        'Your sign-in has expired, so this could not be saved. Sign in again and your entry will go through — nothing has been lost from this form.',
      signedOut: true,
    }
  }

  if (text.includes('row-level security') || text.includes('row level security')) {
    return { message: 'Your role is not allowed to make this change.', signedOut: false }
  }

  if (text.includes('duplicate key')) {
    return { message: 'That record already exists.', signedOut: false }
  }

  if (text.includes('violates foreign key')) {
    return {
      message: 'Something this refers to no longer exists. Reload the page and try again.',
      signedOut: false,
    }
  }

  if (text.includes('failed to fetch') || text.includes('networkerror')) {
    return { message: 'No connection to the server. Check your internet and try again.', signedOut: false }
  }

  // Anything unrecognised is passed through rather than replaced with a
  // vague apology: a message we have not seen is more useful verbatim.
  return { message: raw?.trim() || 'That could not be saved.', signedOut: false }
}
