# BEMU — Minimal Static Shop

This is a minimal, static storefront for the BEMU project. It includes a product grid, cart with localStorage persistence, and a demo checkout form (no payments).

Quick start

1. Open `index.html` in your browser (double-click or serve with a static server).

Optional: serve with a local server to avoid CORS when loading `products.json`:

```bash
# Python 3
python3 -m http.server 8000
# then open http://localhost:8000/BEMU/
```

Next steps

- Add real product images and inventory
- Integrate a payment provider (Stripe, PayPal)
- Add a backend to handle orders and emails

Backend + Stripe (quick start)

1. Install Node and npm (macOS: `brew install node` or from nodejs.org).
2. In the project, install server deps and set your Stripe secret key:

```bash
cd BEMU/server
cp .env.example .env
# edit .env and set STRIPE_SECRET_KEY=sk_test_...
npm install
npm run dev
```

3. Open `http://localhost:4242/BEMU/` and use the site. Checkout will redirect to Stripe Checkout (requires a valid `STRIPE_SECRET_KEY`).

Notes

- The server serves the frontend and provides `/api/products` and `/api/create-checkout-session`.
- Images are pulled from Unsplash via dynamic source URLs; replace with your own images for stable assets.
- To go live, set real Stripe keys and follow Stripe's production checklist.

Stripe webhooks (mark orders paid)

1. Set `STRIPE_WEBHOOK_SECRET` in `BEMU/server/.env` (see `.env.example`).
2. For local testing, install the Stripe CLI and forward events:

```bash
# install: https://stripe.com/docs/stripe-cli
stripe login
stripe listen --forward-to localhost:4242/webhook
```

When you create a Checkout session and complete a payment with a Stripe test card, the CLI will forward the `checkout.session.completed` event to `/webhook` and the server will update the matching order record to `paid`.

Wiring Stripe keys

1. Copy `.env.example` to `.env` and set `STRIPE_SECRET_KEY` (test key), `STRIPE_WEBHOOK_SECRET` (from stripe listen output), and `ADMIN_TOKEN`.

Testing the server locally

```bash
cd BEMU/server
npm install
# start server (dev uses nodemon)
npm run dev
```

Then open `http://localhost:4242/BEMU/`.
