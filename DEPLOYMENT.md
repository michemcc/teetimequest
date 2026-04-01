# TeeTimeQuest — Deployment Guide

How to deploy TeeTimeQuest on Vercel and connect a custom domain bought on AWS Route 53.

---

## Part 1 — Deploy to Vercel

### Step 1: Push your code to GitHub

If you haven't already, create a GitHub repo and push the project:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/teetimequest.git
git push -u origin main
```

### Step 2: Import into Vercel

1. Go to [vercel.com](https://vercel.com) and sign in (or create a free account)
2. Click **"Add New Project"**
3. Click **"Import Git Repository"** and connect your GitHub account
4. Select your `teetimequest` repository
5. Vercel will auto-detect it as a **Vite** project. Confirm these settings:
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`
6. Click **"Deploy"**

Your app will be live in ~60 seconds at a URL like:
```
https://teetimequest-abc123.vercel.app
```

### Step 3: Every future deploy

Just push to `main` — Vercel auto-deploys on every commit:
```bash
git add .
git commit -m "Update something"
git push
```

---

## Part 2 — Buy a domain on AWS Route 53

1. Go to [AWS Console](https://console.aws.amazon.com) → search **Route 53**
2. Click **"Register domain"**
3. Search for `teetimequest.com` (or `.io`, `.app`, etc.)
4. Add to cart → fill in registrant contact info → complete purchase
5. AWS will send a verification email — **click the link in it** or your domain gets suspended
6. Wait 10–30 minutes for registration to complete

> Domains typically cost $12–$15/year for `.com` on Route 53.

---

## Part 3 — Connect your AWS domain to Vercel

This is a two-part process: tell Vercel about your domain, then point AWS DNS at Vercel.

### Step A: Add your domain in Vercel

1. In your Vercel project dashboard, go to **Settings → Domains**
2. Type `teetimequest.com` and click **Add**
3. Also add `www.teetimequest.com` — Vercel will offer to auto-redirect www → root (recommended)
4. Vercel will show you the DNS records you need to add. You'll see something like:

| Type  | Name | Value                        |
|-------|------|------------------------------|
| A     | @    | `76.76.21.21`                |
| CNAME | www  | `cname.vercel-dns.com`       |

> Copy these values — you'll need them in the next step.

### Step B: Add DNS records in AWS Route 53

1. Go to **Route 53 → Hosted Zones**
2. Click on your domain (`teetimequest.com`)
3. Click **"Create record"** for each record Vercel gave you:

**For the root domain (`@` / apex):**
- Record type: **A**
- Record name: *(leave blank for root)*
- Value: `76.76.21.21`
- TTL: `300`
- Click **Create records**

**For www:**
- Record type: **CNAME**
- Record name: `www`
- Value: `cname.vercel-dns.com`
- TTL: `300`
- Click **Create records**

### Step C: Wait for propagation

DNS changes take **5–30 minutes** to propagate (sometimes up to 48 hours in rare cases).

Back in Vercel under **Settings → Domains**, the status will change from a yellow warning to a green **"Valid Configuration"** checkmark once it's working.

### Step D: SSL is automatic

Vercel provisions a free SSL certificate (via Let's Encrypt) automatically once your domain is connected. Your site will be live at:

```
https://teetimequest.com
https://www.teetimequest.com  ← redirects to above
```

---

## Troubleshooting

**Domain still showing Vercel's default URL after 30 min?**
- Double-check the A record value matches exactly what Vercel shows
- In Route 53, make sure you didn't accidentally add a trailing dot or space

**Vercel shows "Invalid Configuration"?**
- Go to Route 53 and verify the records are saved correctly
- Try clicking "Refresh" in Vercel's domain settings

**www not redirecting?**
- Make sure you added both `teetimequest.com` AND `www.teetimequest.com` in Vercel's domain settings
- Vercel handles the redirect automatically once both are added

**Getting a certificate error in browser?**
- SSL provisioning can take up to 10 minutes after DNS propagates
- Try again in a few minutes

---

## Environment Variables (for future backend)

When you're ready to connect a real API (tee-time data, email delivery, etc.), add environment variables in Vercel:

1. Go to **Settings → Environment Variables**
2. Add your keys (e.g. `VITE_API_URL`, `VITE_GOLF_API_KEY`)
3. Redeploy — they'll be injected at build time

> Note: In Vite, env vars must be prefixed with `VITE_` to be accessible in the browser.
> Example: `import.meta.env.VITE_API_URL`

---

## Quick Reference

| Task | Command / Location |
|------|--------------------|
| Local dev | `npm run dev` |
| Production build | `npm run build` |
| Preview build locally | `npm run preview` |
| Deploy | `git push` (auto-deploys via Vercel) |
| Add domain | Vercel → Settings → Domains |
| DNS records | AWS Route 53 → Hosted Zones |
| SSL cert | Automatic via Vercel / Let's Encrypt |
| Env vars | Vercel → Settings → Environment Variables |
