# 🚀 ClinoSim Pro — 10-Minute Quick Start

## Your URLs (After Deployment)

| Component | Status | URL |
|-----------|--------|-----|
| **Frontend UI** | 🔄 Deploy to Vercel | https://clinostat.vercel.app |
| **Backend API** | 🔄 Deploy to Railway | https://clinosim-backend.railway.app |
| **GitHub Repo** | ✅ Done | https://github.com/Pranay1004/clinostat |

---

## 📋 Deployment Checklist (In Order)

### **✅ Already Done**
- [x] Code pushed to GitHub

### **🔄 Next: Frontend (2 minutes)**
```
1. Go to https://vercel.com/new
2. Import: https://github.com/Pranay1004/clinostat
3. Click Deploy
4. Get URL: https://clinostat.vercel.app
```

### **🔄 Then: Backend (5 minutes)**
```
1. Go to https://railway.app
2. Click "New Project" → "Deploy from GitHub"
3. Repo: Pranay1004/clinostat
4. Root directory: backend/
5. Add env vars (see below)
6. Deploy
```

**Railway Environment Variables:**
```
NODE_ENV=production
PORT=3000
WS_PORT=3001
FRONTEND_URL=https://clinostat.vercel.app
CLINOSTAT_WIFI_IP=192.168.1.100
```

### **🔄 Finally: Connect Frontend to Backend**
Edit [js/app.js](js/app.js):
```javascript
// Line ~5, change:
const API_URL = 'https://clinosim-backend.railway.app';
const WS_URL = 'wss://clinosim-backend.railway.app';
```

Push to GitHub → Vercel auto-redeploys ✅

---

## 🎮 Connecting Your Clinostat

### **WiFi Connection (Most Reliable)**
Your clinostat connects directly to the backend:
```
Clinostat (192.168.1.100:5555)
    ↓ WiFi
Router
    ↓ ngrok tunnel
    ↓
Backend (Railway)
    ↓
Frontend (Vercel)
    ↓
Browser
```

**Setup:**
```bash
# On the computer connected to your clinostat:
brew install ngrok
ngrok http 192.168.1.100:5555
# Get URL like: https://abc123.ngrok.io

# Update Railway env var:
CLINOSTAT_WIFI_IP=abc123.ngrok.io
```

### **USB/Serial Connection**
```bash
# On your computer with clinostat:
cd backend
npm install
npm run dev  # Runs on localhost:3000

# Expose to internet:
ngrok http 3000
# Railway can now reach: https://abc123.ngrok.io
```

### **Bluetooth Connection**
Use a Raspberry Pi with Bluetooth support running the backend.

---

## 🧪 Test Everything Works

```bash
# 1. Test frontend loads
curl https://clinostat.vercel.app

# 2. Test backend API
curl https://clinosim-backend.railway.app/api/health

# 3. Test WebSocket from browser console
const ws = new WebSocket('wss://clinosim-backend.railway.app');
ws.onopen = () => console.log('✅ WebSocket Connected!');

# 4. Test hardware discovery
curl https://clinosim-backend.railway.app/api/devices/discover
```

---

## 🔗 Key Files

| File | Purpose |
|------|---------|
| [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) | Full step-by-step guide |
| [backend/server.js](backend/server.js) | Express API server |
| [backend/hardware/wifi-bridge.js](backend/hardware/wifi-bridge.js) | WiFi connection |
| [backend/hardware/usb-bridge.js](backend/hardware/usb-bridge.js) | Serial connection |
| [backend/hardware/bluetooth-bridge.js](backend/hardware/bluetooth-bridge.js) | BLE connection |
| [js/app.js](js/app.js) | Frontend app (update API URLs here) |

---

## 💰 Cost Analysis (Free Tier)

| Service | Cost | Notes |
|---------|------|-------|
| Vercel | **FREE** | 100GB bandwidth, unlimited deploys |
| Railway | **$5/mo credit** | Covers small backend easily |
| ngrok | **FREE** | Public tunnel, rate limited |
| GitHub | **FREE** | Private repos included |
| **TOTAL** | **$0/month** | ✅ Completely free! |

---

## ❓ FAQs

**Q: Can anyone access my clinostat from the internet?**  
A: Only if they have your ngrok URL or port forward. Add authentication (auth tokens) for security.

**Q: How do I run simulations from any location?**  
A: The UI is on Vercel (worldwide CDN), backend on Railway (global servers), so access is global! Just click "Run Simulation".

**Q: Can I connect multiple clinostats?**  
A: Yes! Register each one in `/api/devices/discover` with unique IDs. The UI has a device selector.

**Q: What if my WiFi goes down?**  
A: ngrok reconnects automatically. You won't be able to access the hardware but can still run pure simulations.

**Q: Is this secure?**  
A: With ngrok free tier, URLs are public but hard to guess. For production, add JWT authentication.

---

## 🆘 Common Issues

### "Cannot connect to clinostat"
- [ ] Verify clinostat power is on
- [ ] Check WiFi connection: `ping 192.168.1.100`
- [ ] ngrok tunnel running: `pgrep ngrok`
- [ ] Railway env var updated with ngrok URL

### "CORS error in browser console"
- [ ] Update `FRONTEND_URL` in Railway env vars
- [ ] Restart backend (redeploy on Railway)
- [ ] Clear browser cache (Cmd+Shift+R)

### "WebSocket connection failed"
- [ ] Use `wss://` (secure) not `ws://`
- [ ] Check firewall allows WebSockets
- [ ] See browser dev tools → Network → WS tab

---

## 📞 Support

- **Backend issues:** Check Railway logs: `railway logs`
- **Frontend issues:** Check Vercel logs: https://vercel.com/dashboard
- **Hardware issues:** Check clinostat UART terminal
- **GitHub issues:** https://github.com/Pranay1004/clinostat/issues

---

**Ready?** Start with the **Frontend Deployment** above! 🚀
