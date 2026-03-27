# ClinoSim Pro — Complete Deployment Guide

## 🌐 Infrastructure Overview

```
Your Frontend (Vercel)
     ↓
Browser runs ClinoSim UI
     ↓
    HTTP + WebSocket requests
     ↓
Your Backend (Railway)
     ↓
Connects to clinostats (WiFi/Serial/BT)
     ↓
Physical Hardware
```

---

## 📋 Step-by-Step Deployment

### **Step 1: Frontend Deployment (Vercel)** ✅ READY
1. Go to **https://vercel.com/new**
2. Click **"Import Git Repository"**
3. Paste: `https://github.com/Pranay1004/clinostat`
4. **Project name:** `clinostat`
5. **Root Directory:** `.` (default)
6. Click **"Deploy"**
7. Wait ~2 minutes
8. Vercel creates URL: `https://clinostat.vercel.app` ✅

**Your frontend is now publicly accessible!**

---

### **Step 2: Backend Deployment (Railway)** 🔧 DO THIS NEXT

Railway.app provides a free tier ($5/month credit) for hosting Node.js backends.

#### **2.1 Create Railway Account**
1. Go to **https://railway.app**
2. Sign up with GitHub (one-click)
3. Create new project

#### **2.2 Deploy Backend to Railway**
Option A: **Git-based (Recommended)**
```bash
# 1. Install Railway CLI
npm install -g @railway/cli

# 2. Login
railway login

# 3. Initialize Railway project in your `backend/` folder
cd /Users/pandeyji/Desktop/antigravity/ClinoSimPro/backend
railway init

# 4. Deploy
railway up
```

Option B: **Via GitHub (Auto-deploy)**
1. Go to railway.app dashboard
2. Click "New Project" → "Deploy from GitHub"
3. Select: `Pranay1004/clinostat`
4. Set root directory: `backend/`
5. Auto-deploys on git push! 🚀

#### **2.3 Set Environment Variables on Railway**
1. In Railway dashboard, go to **Variables**
2. Add:
```
NODE_ENV=production
PORT=3000
WS_PORT=3001
FRONTEND_URL=https://clinostat.vercel.app
CLINOSTAT_WIFI_IP=<your-clinostat-ip>
```
3. Click **"Deploy"**

**Your backend URL:** `https://clinosim-backend.railway.app` (or custom domain)

---

### **Step 3: Connect Frontend ↔ Backend**

Edit [js/app.js](js/app.js) to use the backend API:

```javascript
// Old (localhost):
const API_URL = 'http://localhost:3000';
const WS_URL = 'ws://localhost:3001';

// New (production):
const API_URL = 'https://clinosim-backend.railway.app';
const WS_URL = 'wss://clinosim-backend.railway.app';  // WebSocket over HTTPS
```

Then push to GitHub:
```bash
git add .
git commit -m "Connect to cloud backend"
git push origin main
```

Vercel auto-redeploys! ✅

---

## 🎮 Hardware Connection Options

### **Option 1: WiFi-Connected Clinostat (Recommended)**

Your clinostat needs:
- WiFi module (ESP32 or similar)
- IP address on your local network

**From anywhere on the internet:**
```
ClinoSimPro (Vercel)
    ↓
Cloud Backend (Railway)
    ↓
ngrok tunnel OR port forward
    ↓
Your home WiFi router
    ↓
Clinostat at 192.168.1.100
```

**To enable remote access:**
1. Install **ngrok** on the machine connecting to your clinostat:
```bash
brew install ngrok  # macOS
ngrok http 192.168.1.100:5555
```
2. This gives you: `https://abc123.ngrok.io` (public URL to your clinostat)
3. Update backend `.env`:
```
CLINOSTAT_WIFI_IP=abc123.ngrok.io
```

---

### **Option 2: USB Serial via Computer at Home**

Your PC/Raspberry Pi running the clinostat stays on and connected:
1. Run backend on home PC: `npm run dev`
2. Use ngrok: `ngrok http 3000`
3. Tell Railway the public URL
4. Works from anywhere! 🌍

---

### **Option 3: Bluetooth Bridge (Advanced)**

Bluetooth range is ~100m. For internet access:
1. Use Raspberry Pi with BLE support
2. Pi runs backend with Bluetooth bridge
3. ngrok tunnels the API
4. Access from anywhere

---

## 🔐 Security Checklist

- [ ] Add authentication to backend (JWT tokens)
- [ ] Use HTTPS/WSS everywhere (handled by Vercel + Railway)
- [ ] Set CORS whitelist (only your frontend domain)
- [ ] Protect API endpoints (rate limiting)
- [ ] Don't expose clinostat IP in client code

---

## 🧪 Testing

### **Test Frontend**
```bash
# Open in browser
https://clinostat.vercel.app
```

### **Test Backend**
```bash
# Check API is responding
curl https://clinosim-backend.railway.app/api/health

# Should return:
# {"status":"ok","timestamp":"2026-03-27T...","version":"1.0.0"}
```

### **Test WebSocket**
```javascript
// In browser console:
const ws = new WebSocket('wss://clinosim-backend.railway.app');
ws.onmessage = (e) => console.log('Data:', e.data);
```

### **Test Hardware Connection**
```bash
# SSH into your PC/RPi running clinostat hardware
ssh user@home-computer

# Check if backend can reach clinostat
ping 192.168.1.100

# Or switch to backend folder and test:
cd backend
node -e "
const WiFiBridge = require('./hardware/wifi-bridge');
const bridge = new WiFiBridge({ ip: '192.168.1.100' });
bridge.connect().then(() => console.log('✅ Connected!')).catch(e => console.error(e));
"
```

---

## 🚀 What's Next

1. **Add Authentication** - Protect your API from unauthorized access
2. **Real-time Dashboard** - WebSocket sensor stream to UI
3. **Data Logger** - Store historical simulations in database
4. **Mobile App** - React Native version for field testing
5. **Multi-device** - Support multiple clinostats simultaneously

---

## 📞 Troubleshooting

### Backend not connecting to clinostat
- Check firewall (port 5555, 3000 must be open)
- Verify clinostat IP: `ping 192.168.1.100`
- Check Serial port: `ls /dev/tty*` (USB) or `noble scan` (BLE)

### CORS errors in browser console
- Edit backend `server.js` CORS config
- Ensure `FRONTEND_URL` matches your Vercel domain
- Restart backend

### WebSocket connection fails
- WebSocket must use `wss://` (secure) in production
- Check Railway environment has `WS_PORT=3001`
- Browser dev tools → Network tab → WS connections

### Cannot access clinostat from internet
- Use ngrok/tunneling (see Option 2 above)
- Or setup port forwarding on home router (risky!)
- Or use cloud device management service

---

## 📊 Monitoring

**Railway Dashboard:**
- Check logs: `railway logs`
- Monitor CPU/memory
- See deployment history

**Vercel Dashboard:**
- View page performance
- Analytics (visitor count)
- Function execution time

Both have **free tiers** for personal projects! 🎉
