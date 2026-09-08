# Deploy — Employee Tracking

Do cheezein karni hain: **(A) Vercel pe live karna**, **(B) Google login chalu karna**.
Dono me kuch steps sirf aap kar sakte hain (aapke GitHub / Vercel / Google account chahiye).

Code taraf ka kaam ho chuka hai — repo ready hai, build clean hai, aur OAuth callback
Vercel ke proxy ke liye fix kar diya gaya hai.

---

## A. Vercel pe deploy

### 1. GitHub pe code daalein

<https://github.com/new> → naya **private** repo banayein, naam `employee-tracking`.
Repo banane ke baad terminal me (project folder me):

```bash
git remote add origin https://github.com/<aapka-username>/employee-tracking.git
git push -u origin main
```

`.env.local` commit **nahi** hoga — `.gitignore` me hai, checked.

### 2. Vercel pe import karein

<https://vercel.com/new> → GitHub connect karein → `employee-tracking` repo **Import**.
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
- [ ] Dashboard pe data dikh raha hai (51 employees)
- [ ] Reports → **Download PDF** ek page ka aa raha hai
- [ ] Mobile pe kholke dekh lein

## Aage code badla to?

`git push` karte hi Vercel apne aap naya version live kar dega. Alag se kuch
nahi karna.
