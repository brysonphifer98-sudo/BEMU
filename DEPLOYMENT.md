Deployment steps — quick guide

1) Verify locally
- From project root:

```bash
cd server
npm install
npm run dev   # requires nodemon, or use `npm start` to run once
```
- Open http://localhost:3000 to verify the site and API endpoints.

2) Prepare repository
- Create a GitHub repo and push your project:

```bash
git init
git add .
git commit -m "Initial commit"
# create repo on GitHub, then:
git remote add origin git@github.com:YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

3) Recommended deploy: Render (free/paid tiers)
- On Render, create a new "Web Service" and connect your GitHub repository.
- Set the root to the `server` directory (if asked) and the start command to:

```
npm start
```
- Add environment variables in Render's dashboard using the values from `server/.env.example`.

4) Stripe webhook
- In the Stripe dashboard, add a webhook with the URL `https://<YOUR_DOMAIN>/webhook`.
- Subscribe to `checkout.session.completed` and set the webhook signing secret into `STRIPE_WEBHOOK_SECRET`.

5) Post-deploy validation
- Visit the live URL, test product listing at `/api/products`, and place a test checkout.
- Check server logs for webhook delivery and order status updates.

If you want, I can:
- Create a Git repo and commit these changes locally.
- Help craft a GitHub repo README and push to GitHub (you'll need to provide access).
- Prepare a `Dockerfile` for container deployments.
