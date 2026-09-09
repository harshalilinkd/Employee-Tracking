# Deploy — Employee Tracking

Teen cheezein: **(A) Vercel pe live karna**, **(B) Google login chalu karna**,
**(C) database migrations chalana**. Kuch steps sirf aap kar sakte hain
(aapke Vercel / Google / Supabase account chahiye).

Code ka kaam ho chuka hai — build clean hai aur OAuth callback fix hai.

---

## A. Vercel pe deploy

### 1. GitHub — ho chuka hai

Repo already bana hua hai aur code push ho chuka hai:

<https://github.com/harshalilinkd/Employee-Tracking>

`.env.local` commit **nahi** hota — `.gitignore` me hai, checked.

### 2. Vercel pe import karein

<https://vercel.com/new> → GitHub connect karein → **Employee-Tracking** repo **Import**.
Framework Next.js apne aap detect ho jayega. Abhi **Deploy dabane se pehle** step 3 karein.

### 3. Environment Variables daalein — ye sabse zaroori step hai

Vercel ke import screen pe **Environment Variables** kholein aur do variable daalein.
Values aapki local `.env.local` file me hain — wahi copy karein:

| Name | Value kahan se |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `.env.local` se |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `.env.local` se |

Teeno environment (Production, Preview, Development) ke liye tick karein.

> Ye do na daale to build to ho jayega, par app khulte hi blank/error dega —
> kyunki Supabase ka address hi nahi milega.

Ab **Deploy** dabayein. 2–3 minute me URL mil jayega, jaise
`https://employee-tracking-xxxx.vercel.app`

### 4. Supabase ko naya URL batayein

Supabase → **Authentication → URL Configuration**:

- **Site URL**: `https://employee-tracking-xxxx.vercel.app`
- **Redirect URLs** me ye dono add karein:
  - `https://employee-tracking-xxxx.vercel.app/auth/callback`
  - `http://localhost:3000/auth/callback` *(local kaam karta rahe isliye)*

Ye na kiya to login ke baad "redirect not allowed" error aayega.

---

## C. Database migrations — ye bhool gaye to app error dega

Vercel se code deploy hota hai, **database nahi**. Migrations aapko Supabase me
chalane padte hain, warna screen pe error aayega jaise
*"Could not find the table … in the schema cache"*.

Supabase → **SQL Editor** → file ka content paste karein → **Run**.
Sab idempotent hain, dobara chalane se kuch nahi bigadta.

| File | Kya karta hai | Status |
|---|---|---|
| `supabase/migrations/009_observers.sql` | Observers master + `observed_by` column | chal chuka |
| `supabase/migrations/010_event_delete.sql` | Event permanently delete karne ki permission | chal chuka |
| `supabase/migrations/011_audit_one_row_per_action.sql` | Audit ek row per save + per-record history | **check karein** |

### Go-live se pehle — trial data hatana

`docs/go-live-reset.sql` chalayein. Ye saare test events, attachments, audit log aur
reference counter clear kar deta hai, lekin **employees, departments, categories,
observers aur logins rehne deta hai**. Uske baad pehla asli record `PE-2026-0001` se
shuru hoga.

> Ye file `docs/` me hai, `supabase/migrations/` me **nahi** — kyunki migration har
> naye environment pe dobara chalti hai aur ye uska data mita deti.

Backup pehle le lein: Supabase → **Database → Backups**. Iska undo nahi hai.

---

## D. Email + password login

Login page pe dono option hain — Google aur email+password. Password wala tab
chalega jab har user ka password set ho.

1. Supabase → **Authentication → Providers → Email** enable hona chahiye.
2. Service role key lein: Supabase → **Settings → API → service_role**.
3. Terminal me (project folder me):

```powershell
$env:SUPABASE_SERVICE_ROLE_KEY="eyJ..."
node scripts/set-passwords.mjs           # preview — kuch change nahi hota
node scripts/set-passwords.mjs --apply    # ab set karta hai
```

Password har user ka **first name + 123** hota hai — "Harshali Bhopale" →
`Harshali123`. Script preview me poori list dikhata hai.

> Service role key RLS bypass karta hai. Use kisi file me save na karein, chat me
> paste na karein, aur kaam hone ke baad terminal band kar dein.

Google login isse band nahi hota — dono saath chalte hain. Pehli baar login ke
baad sabko password badalne ko kahein.

---

## B. Google login ("Continue with Google")

Button aur code **pehle se app me hai**. Sirf Google se chaabi leni hai.

### 1. Google Cloud Console me OAuth client banayein

<https://console.cloud.google.com/apis/credentials>

1. Project banayein (ya purana chunein)
2. **Configure Consent Screen** → **Internal** chunein agar Google Workspace hai,
   warna **External**. App name: `Employee Tracking`. Support email daalein.
3. **Create Credentials → OAuth client ID** → type: **Web application**
4. **Authorised redirect URIs** me sirf ye ek daalein:

```
https://mingqlwwbwnrkyhklpyq.supabase.co/auth/v1/callback
```

> Dhyaan dein: yahan **Supabase ka URL** aata hai, aapki app ka nahi.
> Google → Supabase → phir aapki app — is order me chalta hai.

5. **Create** dabayein → **Client ID** aur **Client Secret** copy karein

### 2. Supabase me daalein

Supabase → **Authentication → Providers → Google**:

- Enable karein
- Client ID aur Client Secret paste karein
- **Save**

Bas. Ab login page pe "Continue with Google" kaam karega.

---

## Ek zaroori baat — Google se koi bhi login nahi kar payega

Ye system **invite-only** hai. Google se sign in karne par bhi wahi log andar aayenge
jinka email **User access** me pehle se added hai.

Naye insaan ko access dene ka tareeka:

**Settings → User access → Give someone access** → unka Gmail daalein → role chunein.

Uske baad wo "Continue with Google" se ek click me andar aa jayenge — password ki
zarurat nahi. Jiska email add nahi hai, use "access nahi hai" dikhega, chahe uska
Google account sahi ho.

Ye database me enforce hai (RLS), sirf screen pe chhupaya nahi gaya.

---

## Deploy ke baad check-list

- [ ] Login page khul raha hai
- [ ] Email + password se login ho raha hai
- [ ] "Continue with Google" se login ho raha hai
- [ ] Dashboard khul raha hai (51 employees)
- [ ] Performance page pe record add ho raha hai
- [ ] Row ke **⋮ menu** se View / Edit / Archive / Delete chal raha hai
- [ ] Settings → **Observers** me naam add ho raha hai (011 chala hai to hi)
- [ ] Settings → **Audit log** record-wise group dikha raha hai
- [ ] Reports → **Download PDF** ek page ka aa raha hai
- [ ] Mobile pe kholke dekh lein

## Aage code badla to?

`git push` karte hi Vercel apne aap naya version live kar dega. Alag se kuch
nahi karna.
