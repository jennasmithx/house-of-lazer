# House of Lazer

Website for House of Lazer: laser tattoo removal, microneedling and skin treatments, with an online shop, customer accounts, and PayFast checkout (collect in store or delivery).

It uses the same setup as PetPaw Haven (Vercel + Supabase + PayFast + Resend), with customer login done the MineCentral way (Supabase Auth).

## Pages

| Page | Path |
| --- | --- |
| Home, About, Services, Shop, Gallery, Contact | `/`, `/about`, `/services`, `/shop`, `/gallery`, `/contact` |
| Cart & checkout | `/cart` |
| Sign in, create account, my orders & details | `/account` |
| Forgot / reset password | `/forgot-password`, `/reset-password` |

## Project layout

```
public/          Static site (HTML, CSS, browser JS)
api/             Vercel serverless functions, one per endpoint
lib/             Shared server code (PayFast, Supabase, email, pricing)
data/            Product and service catalogue (the price source of truth)
schema.sql       Supabase tables, sign-up trigger and security rules
dev-server.js    Runs the site + api/ locally, the way Vercel does
```

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor**, paste the contents of `schema.sql`, and click **Run**.
3. Under **Authentication > URL Configuration**, set **Site URL** to the live site address, and add these **Redirect URLs** (plus the same for `http://localhost:3000` while testing):
   - `https://YOUR-SITE/account`
   - `https://YOUR-SITE/reset-password`
4. Under **Project Settings > API**, copy the Project URL, the publishable (anon) key and the service role key into your environment variables (see below).
5. To make the owner an admin (for the admin page, coming next): after she signs up on the site, open **Table Editor > profiles** and tick `is_admin` on her row.

### 2. Environment variables

Copy `.env.example` to `.env` for local development. On Vercel, add the same variables under **Project > Settings > Environment Variables**. The file explains each one.

**The service role key is secret.** It only belongs in `.env` and Vercel settings, never in `public/`.

### 3. Run locally

```bash
npm install
npm run dev     # http://localhost:3000
npm test
```

### 4. Deploy

Import the repo into [Vercel](https://vercel.com). There's no build step: Vercel serves `public/` and turns each file in `api/` into a function. Add the environment variables and deploy.

## How checkout works

1. The cart lives in the browser. At checkout the browser sends only product IDs and quantities to `/api/checkout`, plus the customer's login token if they're signed in.
2. The server prices the order from `data/products.json`, adds the delivery fee if needed, and saves a **pending** order in Supabase, linked to the customer's account if they're signed in. It then returns the PayFast form fields.
3. The browser posts that form to PayFast, where the customer pays.
4. PayFast notifies `/api/payfast-notify`. The server checks the merchant ID, the signature (on the raw body, as PetPaw Haven does), PayFast's own validation endpoint and the amount. Only then is the order marked **paid**, and the confirmation emails go out once.
5. The customer returns to `/checkout-success`, which shows the payment status.

Guests can always check out without an account. Signed-in customers get their saved details filled in, and their orders appear under **My account**.

### PayFast sandbox

The defaults use PayFast's shared sandbox merchant (`10000100`). That account's passphrase isn't public, so requests to it are sent unsigned, and notifications are verified through PayFast's validation endpoint only.

For proper testing, create your own sandbox account at <https://sandbox.payfast.co.za>, set a passphrase, and put your merchant ID, key and passphrase in the environment variables. Full signing then switches on. Payment notifications need a public URL, so test the full flow on a Vercel preview deployment (or use ngrok locally).

### Going live

1. Set `PAYFAST_SANDBOX=false` with the live merchant ID, key and passphrase. A passphrase is required in live mode.
2. Set `SITE_URL` to the real domain.
3. Set up Resend with a verified domain so emails send (`RESEND_API_KEY`, `EMAIL_FROM`, `STORE_EMAIL`).
4. Customise Supabase's sign-up and password reset emails under **Authentication > Emails** so they're branded House of Lazer.

## Customising content

- **Products:** `data/products.json`. Add `"image": "/images/products/name.jpg"` to show a photo.
- **Services & prices:** `data/services.json`
- **Gallery photos:** put them in `public/images/gallery/` and list them at the top of `public/js/gallery.js`.
- **Contact details, social links:** `SITE` at the top of `public/js/site.js`
- **About page** (founder name, stats): `public/about.html`
- **Opening hours:** `public/contact.html`
- **Colours & fonts:** CSS variables at the top of `public/css/styles.css`

All prices, contact details and About page text are placeholders. Replace them before launch.
