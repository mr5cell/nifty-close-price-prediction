# Nifty Close Price Prediction Competition

Live prediction competition website for Nifty 50 closing prices.

## 🚀 Quick Deploy to Render

### One-Click Deploy
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/mr5cell/nifty-close-price-prediction)

### Manual Deploy Steps

1. **Fork/Clone this repository**

2. **Go to [Render Dashboard](https://dashboard.render.com/)**

3. **Create New Web Service**
   - Connect your GitHub account
   - Select this repository
   - Use these settings:
     - Name: `nifty-prediction`
     - Region: Choose nearest
     - Branch: `main`
     - Runtime: `Node`
     - Build Command: `npm install`
     - Start Command: `npm start`

4. **Add Environment Variables** (in Render Dashboard)
   ```
   KITE_API_KEY=u1hw0il15nowm3db
   KITE_API_SECRET=v0ex0xk65wob9ddm6fvjzh0g22xm470i
   KITE_REQUEST_TOKEN=bSh9kaX619n2jtkJ7KN95ZSaw2GKEIMr
   ADMIN_PIN=15081947
   ```

5. **Deploy** - Click "Create Web Service"

6. **Access Your App**
   - Your app will be live at: `https://nifty-prediction.onrender.com`
   - Admin panel: `/admin` (PIN: 15081947)

## 🛠 Local Development

```bash
# Install dependencies
npm install

# Configure .env file with your Kite Connect credentials

# Run locally
npm start
```

## 📱 Features

- Real-time Nifty 50 price tracking
- Public prediction submissions
- Admin panel for contest management
- Bulk CSV uploads
- Automatic token generation from Kite Connect

## 🔐 Admin Access

- URL: `/admin`
- PIN: `15081947`

## 📝 API Credentials

Get your Kite Connect API credentials from:
https://kite.zerodha.com/connect/login

## 🌐 Alternative Hosting Options

- **Railway**: [railway.app](https://railway.app)
- **Heroku**: [heroku.com](https://heroku.com)
- **Cyclic**: [cyclic.sh](https://cyclic.sh)
- **Vercel**: [vercel.com](https://vercel.com) (requires serverless adaptation)