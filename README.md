# House of Lazer

Website for House of Lazer: laser tattoo removal, microneedling and skin treatments, with an online shop that takes payment through PayFast (collect in store or delivery).

## Pages

| Page | Path |
| --- | --- |
| Home | `/` |
| About | `/about` |
| Services & pricing | `/services` |
| Shop | `/shop` |
| Gallery | `/gallery` |
| Contact & bookings | `/contact` |
| Cart & checkout | `/cart` |

## Running locally

Requires Node.js 18 or later.

```bash
npm install
cp .env.example .env   # optional, defaults work for the PayFast sandbox
npm start              # http://localhost:3000
npm test
```

## How checkout works

1. The cart lives in the browser. At checkout the browser sends only product IDs and quantities to `POST /api/checkout`.
2. The server prices the order from `data/products.json`, adds the delivery fee if delivery is chosen, saves a **pending** order, and returns the PayFast form fields. Prices in the browser are never trusted.
3. The browser posts that form to PayFast, where the customer pays.
4. PayFast sends a payment notification (ITN) to `/api/payfast/notify`. The server checks the amount and confirms the notification with PayFast. When a passphrase is configured it also verifies the signature. Only then is the order marked **paid**.
5. The customer returns to `/checkout-success`, which shows the payment status.

Orders are saved in `data/orders.json` and contact messages in `data/messages.json`. Both files are git-ignored. This is fine for testing, but move to a real database before going live.

### PayFast sandbox

The defaults use PayFast's shared sandbox merchant (`10000100`), so checkout works out of the box with no real money. That shared account's passphrase isn't public, so requests to it are sent unsigned.

For proper testing, create your own free account at <https://sandbox.payfast.co.za>, set a passphrase under **Settings**, and put your merchant ID, key and passphrase in `.env`. Every request and notification is then signed and verified.

**Payment notifications need a public URL.** PayFast can't reach `localhost`, so orders stay "pending" locally. To test the full flow, expose the server with a tunnel such as `ngrok http 3000` and set `BASE_URL` to the tunnel URL.

### Going live

1. Set `PAYFAST_SANDBOX=false` and use your live merchant ID, key and passphrase. The server refuses to start in live mode without a passphrase.
2. Set `BASE_URL` to the real https domain.
3. Replace the JSON-file store with a database and add a way for the business to view orders, for example an admin page or email notifications.

## Customising content

- **Products:** `data/products.json`. Add an `"image": "/images/products/name.jpg"` field to show a photo instead of initials.
- **Services & prices:** `data/services.json`
- **Gallery photos:** put images in `public/images/gallery/` and list them at the top of `public/js/gallery.js`.
- **Contact details, social links:** `SITE` at the top of `public/js/site.js`
- **About page text** (founder name, experience stats): `public/about.html`
- **Opening hours:** `public/contact.html`
- **Delivery fee:** `DELIVERY_FEE` in `.env` (default R95)
- **Colours & fonts:** CSS variables at the top of `public/css/styles.css`

All prices, contact details and About page text are placeholders. Replace them with the real details before launch.
