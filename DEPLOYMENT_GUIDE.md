# CledgeFIN Backend — Railway Deployment Guide
**by BusinessPulse Technologies Limited**

---

## BEFORE YOU START — You need these 3 things:

1. **MongoDB Atlas connection string** — from mongodb.com/atlas
2. **Gmail App Password** — from your Google Account settings
3. **Railway account** — from railway.app

---

## STEP 1 — Create GitHub Account and Repository

1. Go to **github.com** and sign up (free)
2. Click the **+** button at the top right → **New repository**
3. Name it: `cledgefin-backend`
4. Set to **Private**
5. Click **Create repository**

---

## STEP 2 — Upload Your Backend Files to GitHub

**Using GitHub website (no coding needed):**

1. Open your `cledgefin-backend` folder on your computer
2. Select ALL files and folders EXCEPT `node_modules` and `.env`
3. Drag and drop them into your GitHub repository page
4. Click **Commit changes**

Files to upload:
- ✅ server.js
- ✅ package.json
- ✅ railway.toml
- ✅ .gitignore
- ✅ routes/ (entire folder)
- ✅ models/ (entire folder)
- ✅ middleware/ (entire folder)
- ✅ emails/ (entire folder)
- ✅ public/ (entire folder — includes CledgeFIN_v1.html)
- ❌ node_modules/ (DO NOT upload — too large)
- ❌ .env (DO NOT upload — contains your secrets)

---

## STEP 3 — Deploy on Railway

1. Go to **railway.app**
2. Click **Login** → sign in with Google
3. Click **New Project**
4. Click **Deploy from GitHub repo**
5. Click **Configure GitHub App** → authorize Railway to access your GitHub
6. Select your `cledgefin-backend` repository
7. Railway will start deploying automatically

---

## STEP 4 — Add Environment Variables on Railway

1. In Railway, click your project
2. Click the service (the box showing your app)
3. Click **Variables** tab
4. Click **New Variable** for each item below:

```
MONGODB_URI          = mongodb+srv://username:password@cluster.mongodb.net/cledgefin
JWT_SECRET           = type_any_long_random_text_here_at_least_32_characters
PAYSTACK_SECRET_KEY  = sk_live_your_paystack_secret_key
PAYSTACK_PUBLIC_KEY  = pk_live_your_paystack_public_key
GMAIL_USER           = businesspulse2026@gmail.com
GMAIL_APP_PASSWORD   = your_16_character_gmail_app_password
ADMIN_EMAIL          = businesspulse2026@gmail.com
COMPANY_NAME         = BusinessPulse Technologies Limited
APP_NAME             = CledgeFIN
APP_URL              = https://your-app-name.up.railway.app
WEBSITE_URL          = https://businesspulse-ng.netlify.app
DOWNLOAD_TOKEN_SECRET = another_long_random_string_here
ADMIN_SECRET_KEY     = your_private_admin_key_for_dashboard
NODE_ENV             = production
PORT                 = 3000
```

5. Click **Deploy** after adding all variables

---

## STEP 5 — Get Your Railway URL

1. In Railway, click your project
2. Click **Settings** tab
3. Scroll to **Networking** section
4. Click **Generate Domain**
5. Copy your URL — it looks like: `https://cledgefin-backend-production.up.railway.app`
6. Go back to **Variables** and update `APP_URL` with this exact URL

---

## STEP 6 — Test Your Deployment

Open your browser and visit:

```
https://YOUR-RAILWAY-URL.up.railway.app/health
```

You should see:
```json
{
  "status": "ok",
  "mongodb": "connected",
  "app": "CledgeFIN Backend"
}
```

If mongodb shows "disconnected" — check your MONGODB_URI variable.

---

## STEP 7 — Set Paystack Webhook (Do this AFTER corporate account is approved)

1. Log in to **dashboard.paystack.com**
2. Click **Settings** → **API Keys and Webhooks**
3. In the **Webhook URL** field enter:
   ```
   https://YOUR-RAILWAY-URL.up.railway.app/api/payment/webhook
   ```
4. Click **Update**

---

## STEP 8 — Set Up Gmail App Password

1. Go to **myaccount.google.com**
2. Click **Security**
3. Click **2-Step Verification** — enable it if not already on
4. Scroll down and click **App Passwords**
5. Select: App = **Mail**, Device = **Other** → type `CledgeFIN`
6. Click **Generate**
7. Copy the 16-character password
8. Paste it as `GMAIL_APP_PASSWORD` in Railway Variables

---

## STEP 9 — Set Up MongoDB Atlas (Free)

1. Go to **mongodb.com/atlas** → **Try Free**
2. Sign up with your Gmail
3. Choose **FREE M0 Shared** cluster
4. Provider: **AWS**, Region: any available
5. Click **Create**
6. Go to **Database Access** → **Add New Database User**
   - Username: `cledgefinuser`
   - Password: create a strong password — **write it down**
   - Role: **Atlas Admin**
7. Go to **Network Access** → **Add IP Address**
   - Click **Allow Access from Anywhere** (0.0.0.0/0)
   - Click **Confirm**
8. Go to **Database** → **Connect** → **Connect your application**
9. Copy the connection string — replace `<password>` with your actual password
10. Add `/cledgefin` before the `?` at the end
11. Paste as `MONGODB_URI` in Railway Variables

---

## TESTING THE API

Once deployed, test with these URLs in your browser:

| Test | URL |
|------|-----|
| Health check | /health |
| API root | / |

To test registration, use Postman or the website contact form.

---

## UPDATING THE APP

When you have a new version of CledgeFIN_v1.html:
1. Replace the file in your `public/` folder
2. Push to GitHub
3. Railway auto-deploys the update in about 2 minutes

---

## SUPPORT

WhatsApp: +2348034041321
Email: businesspulse2026@gmail.com
