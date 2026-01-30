# Nifty Close Price Prediction Competition Website

## Overview
A web application for running Nifty 50 close price prediction competitions. Users can submit their predictions and compete to see who gets closest to the actual closing price.

## Features

### Public Features
- View top 3 predictions closest to live Nifty price
- Submit predictions (limited to ±30% of last close price)
- Real-time leaderboard updates

### Admin Features
- PIN-protected admin panel (PIN: 15081947)
- Start new contests and wipe previous data
- Delete frivolous entries
- Bulk upload predictions via CSV
- Generate Kite Connect access tokens
- Manual trigger for price fetching

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Kite Connect Credentials
Edit the `.env` file with your Kite Connect credentials:
```
KITE_API_KEY=your_api_key_here
KITE_API_SECRET=your_api_secret_here
KITE_REQUEST_TOKEN=your_request_token_here
```

### 3. Generate Access Token
1. Login to Admin Panel (`/admin`)
2. Click "REFRESH TOKEN" to generate access token from request token
3. The access token will be automatically saved to `.env`

### 4. Start the Server
```bash
npm start
```
Or for development with auto-reload:
```bash
npm dev
```

## Usage

### Public Site
- Home page (`/`) - Shows current price and top 3 predictions
- Submit prediction (`/predict`) - Enter name and predicted value

### Admin Panel
- Login (`/admin/login`) - Enter PIN: 15081947
- Dashboard (`/admin`) - Manage contests and predictions
  - **REFRESH TOKEN** - Generate new access token from request token
  - **START FETCHING** - Manually trigger price fetch
  - **START NEW CONTEST** - Create new contest (wipes previous predictions)
  - **DELETE** - Remove individual predictions
  - **UPLOAD CSV** - Bulk upload predictions (format: name,value)

### CSV Format for Bulk Upload
```
John Doe,24500.50
Jane Smith,24650.75
Bob Wilson,24400.00
```

## Technical Details

### Database
- SQLite database (`predictions.db`)
- Tables: contests, predictions, nifty_prices

### Price Fetching
- Kite Connect Quote API for NSE:NIFTY 50
- Runs every minute via cron job
- Stores historical prices in database

### Validation
- Predictions limited to ±30% of last close price
- Admin PIN: 15081947
- Session-based authentication

## API Endpoints

### Public
- `GET /` - Home page with leaderboard
- `GET /predict` - Prediction submission form
- `POST /predict` - Submit prediction

### Admin (Protected)
- `GET /admin/login` - Admin login page
- `POST /admin/login` - Authenticate admin
- `GET /admin` - Admin dashboard
- `POST /admin/new-contest` - Start new contest
- `POST /admin/delete-prediction/:id` - Delete prediction
- `POST /admin/bulk-upload` - Upload CSV
- `POST /admin/refresh-token` - Generate access token
- `POST /admin/start-fetching` - Trigger price fetch
- `GET /admin/logout` - Logout

## Port Configuration
Default port: 3000 (configurable via PORT in .env)

## Security Notes
- Change SESSION_SECRET in production
- Keep Kite Connect credentials secure
- Admin PIN is hardcoded as 15081947