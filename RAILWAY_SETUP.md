# 🚀 Railway Deployment — Ready-to-Use Variables

## Your Vercel Frontend URL
✅ **https://clinostat.vercel.app**

---

## Railway Environment Variables
**Copy ALL of these into Railway Dashboard → Variables:**

```
NODE_ENV=production
PORT=3000
WS_PORT=3001
FRONTEND_URL=https://clinostat.vercel.app
CLINOSTAT_WIFI_IP=192.168.1.100
CLINOSTAT_SERIAL_PORT=/dev/ttyUSB0
CLINOSTAT_BAUD_RATE=115200
```

---

## How to Add to Railway

1. Go to **https://railway.app/dashboard**
2. Click your **clinostat** project
3. Click **"Variables"** tab
4. **Copy-paste each line above** into the form
5. Click **"Save"**
6. Railway auto-deploys ✅

---

## Variables to Update Later (Physical Hardware)

Once you connect your clinostat, you'll update:

| Variable | Current | Will Update To | Why |
|----------|---------|-----------------|-----|
| `CLINOSTAT_WIFI_IP` | `192.168.1.100` | Your clinostat's IP | Direct WiFi connection |
| `CLINOSTAT_SERIAL_PORT` | `/dev/ttyUSB0` | Your USB port (e.g., `/dev/ttyUSB0`, `/dev/ttyACM0`) | USB/Serial connection |
| `CLINOSTAT_BAUD_RATE` | `115200` | Your device's baud rate | Serial communication speed |

---

## Next Steps

### **Now (Before Physical Hardware):**
1. ✅ Deploy backend to Railway (follow above)
2. ✅ Update `js/app.js` with your Railway backend URL
3. ✅ Test API: `curl https://clinosim-backend.railway.app/api/health`

### **Later (When Hardware Arrives):**
1. Discover your clinostat IP/port
2. Update the three variables above in Railway
3. Test hardware connection in web UI
4. Run simulations! 🎉

---

## Railway Backend URL

After deployment, copy this URL from Railway dashboard:
```
https://clinosim-backend-<YOUR-RAILWAY-ID>.railway.app
```

Then update `js/app.js`:
```javascript
const API_URL = 'https://clinosim-backend-<YOUR-RAILWAY-ID>.railway.app';
const WS_URL = 'wss://clinosim-backend-<YOUR-RAILWAY-ID>.railway.app';
```

---

**All set!** You have everything ready for Railway deployment. 🚀
