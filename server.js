const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const axios = require('axios');
const cron = require('node-cron');
const multer = require('multer');
const { parse } = require('csv-parse');
const fs = require('fs');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

const upload = multer({ dest: 'uploads/' });

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(session({
  secret: process.env.SESSION_SECRET || 'secret-key-change-this',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

const db = new sqlite3.Database('predictions.db');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS contests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_active INTEGER DEFAULT 1
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS predictions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contest_id INTEGER,
    name TEXT NOT NULL,
    predicted_value REAL NOT NULL,
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contest_id) REFERENCES contests(id)
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS nifty_prices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    price REAL NOT NULL,
    fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`INSERT INTO contests (name) SELECT 'Default Contest' WHERE NOT EXISTS (SELECT 1 FROM contests)`);
});

let currentNiftyPrice = null;
let lastClosePrice = null;
let accessToken = process.env.KITE_ACCESS_TOKEN;
let isTokenValid = false;
let currentRequestToken = process.env.KITE_REQUEST_TOKEN;
let tokenError = null;

async function generateAccessToken(requestToken = null) {
  try {
    const apiKey = process.env.KITE_API_KEY;
    const apiSecret = process.env.KITE_API_SECRET;
    const tokenToUse = requestToken || currentRequestToken || process.env.KITE_REQUEST_TOKEN;
    
    if (!apiKey || !apiSecret || !tokenToUse) {
      tokenError = 'Missing API credentials or request token';
      console.log('Kite Connect credentials incomplete for token generation');
      return { success: false, error: tokenError };
    }

    const checksum = crypto.createHash('sha256')
      .update(apiKey + tokenToUse + apiSecret)
      .digest('hex');

    const response = await axios.post('https://api.kite.trade/session/token', {
      api_key: apiKey,
      request_token: tokenToUse,
      checksum: checksum
    });

    if (response.data && response.data.data && response.data.data.access_token) {
      accessToken = response.data.data.access_token;
      isTokenValid = true;
      tokenError = null;
      if (requestToken) {
        currentRequestToken = requestToken;
      }
      console.log('Access token generated successfully');
      
      fs.readFile('.env', 'utf8', (err, data) => {
        if (err) return;
        let updatedEnv = data.replace(
          /KITE_ACCESS_TOKEN=.*/,
          `KITE_ACCESS_TOKEN=${accessToken}`
        );
        if (requestToken) {
          updatedEnv = updatedEnv.replace(
            /KITE_REQUEST_TOKEN=.*/,
            `KITE_REQUEST_TOKEN=${requestToken}`
          );
        }
        fs.writeFile('.env', updatedEnv, (err) => {
          if (err) console.error('Error updating .env:', err);
        });
      });
      
      return { success: true, accessToken };
    }
  } catch (error) {
    console.error('Error generating access token:', error.response?.data || error.message);
    if (error.response?.data?.message) {
      tokenError = error.response.data.message;
    } else if (error.response?.status === 403) {
      tokenError = 'Invalid or expired request token. Please get a new one from Kite Connect login.';
    } else {
      tokenError = error.message;
    }
    isTokenValid = false;
    return { success: false, error: tokenError };
  }
}

async function fetchNiftyPrice() {
  try {
    const apiKey = process.env.KITE_API_KEY;
    
    if (!apiKey || !accessToken) {
      console.log('Kite Connect credentials not configured');
      return;
    }

    const response = await axios.get('https://api.kite.trade/quote', {
      params: {
        i: 'NSE:NIFTY 50'
      },
      headers: {
        'X-Kite-Version': '3',
        'Authorization': `token ${apiKey}:${accessToken}`
      }
    });

    if (response.data && response.data.data && response.data.data['NSE:NIFTY 50']) {
      const niftyData = response.data.data['NSE:NIFTY 50'];
      currentNiftyPrice = niftyData.last_price;
      lastClosePrice = niftyData.ohlc.close;
      isTokenValid = true;
      
      db.run('INSERT INTO nifty_prices (price) VALUES (?)', [currentNiftyPrice]);
    }
  } catch (error) {
    console.error('Error fetching Nifty price:', error.message);
    if (error.response && error.response.status === 403) {
      isTokenValid = false;
      console.log('Access token invalid or expired');
    }
  }
}

cron.schedule('* * * * *', () => {
  if (isTokenValid) {
    fetchNiftyPrice();
  }
});

if (accessToken && accessToken !== 'your_access_token_here') {
  fetchNiftyPrice();
}

function requireAdmin(req, res, next) {
  if (req.session.isAdmin) {
    next();
  } else {
    res.redirect('/admin/login');
  }
}

app.get('/', (req, res) => {
  db.get('SELECT * FROM contests WHERE is_active = 1', (err, contest) => {
    if (!contest) {
      return res.render('index', { 
        topPredictions: [], 
        currentPrice: currentNiftyPrice,
        lastClosePrice: lastClosePrice,
        message: 'No active contest'
      });
    }

    if (!currentNiftyPrice) {
      db.all(`SELECT * FROM predictions WHERE contest_id = ? ORDER BY ABS(predicted_value - (SELECT price FROM nifty_prices ORDER BY fetched_at DESC LIMIT 1)) LIMIT 3`, 
        [contest.id], (err, predictions) => {
        res.render('index', { 
          topPredictions: predictions || [], 
          currentPrice: null,
          lastClosePrice: lastClosePrice,
          message: null
        });
      });
    } else {
      db.all(`SELECT * FROM predictions WHERE contest_id = ? ORDER BY ABS(predicted_value - ?) LIMIT 3`, 
        [contest.id, currentNiftyPrice], (err, predictions) => {
        res.render('index', { 
          topPredictions: predictions || [], 
          currentPrice: currentNiftyPrice,
          lastClosePrice: lastClosePrice,
          message: null
        });
      });
    }
  });
});

app.get('/predict', (req, res) => {
  res.render('predict', { 
    lastClosePrice: lastClosePrice,
    error: null,
    success: null
  });
});

app.post('/predict', (req, res) => {
  const { name, predicted_value } = req.body;
  
  if (!name || !predicted_value) {
    return res.render('predict', { 
      lastClosePrice: lastClosePrice,
      error: 'Name and prediction value are required',
      success: null
    });
  }

  const predictedVal = parseFloat(predicted_value);
  
  if (!lastClosePrice) {
    return res.render('predict', { 
      lastClosePrice: lastClosePrice,
      error: 'Unable to verify prediction range. Please try again later.',
      success: null
    });
  }

  const maxChange = lastClosePrice * 0.3;
  const minValue = lastClosePrice - maxChange;
  const maxValue = lastClosePrice + maxChange;

  if (predictedVal < minValue || predictedVal > maxValue) {
    return res.render('predict', { 
      lastClosePrice: lastClosePrice,
      error: `Prediction must be within 30% of last close price (${minValue.toFixed(2)} - ${maxValue.toFixed(2)})`,
      success: null
    });
  }

  db.get('SELECT * FROM contests WHERE is_active = 1', (err, contest) => {
    if (!contest) {
      return res.render('predict', { 
        lastClosePrice: lastClosePrice,
        error: 'No active contest',
        success: null
      });
    }

    db.run('INSERT INTO predictions (contest_id, name, predicted_value) VALUES (?, ?, ?)', 
      [contest.id, name, predictedVal], (err) => {
      if (err) {
        return res.render('predict', { 
          lastClosePrice: lastClosePrice,
          error: 'Error submitting prediction',
          success: null
        });
      }
      res.render('predict', { 
        lastClosePrice: lastClosePrice,
        error: null,
        success: 'Prediction submitted successfully!'
      });
    });
  });
});

app.get('/admin/login', (req, res) => {
  res.render('admin-login', { error: null });
});

app.post('/admin/login', (req, res) => {
  const { pin } = req.body;
  
  if (pin === process.env.ADMIN_PIN) {
    req.session.isAdmin = true;
    res.redirect('/admin');
  } else {
    res.render('admin-login', { error: 'Invalid PIN' });
  }
});

app.get('/admin', requireAdmin, (req, res) => {
  db.all('SELECT * FROM contests ORDER BY created_at DESC', (err, contests) => {
    db.get('SELECT * FROM contests WHERE is_active = 1', (err, activeContest) => {
      if (activeContest) {
        db.all('SELECT * FROM predictions WHERE contest_id = ? ORDER BY submitted_at DESC', 
          [activeContest.id], (err, predictions) => {
          res.render('admin', { 
            contests: contests || [],
            activeContest: activeContest,
            predictions: predictions || [],
            currentPrice: currentNiftyPrice,
            isTokenValid: isTokenValid,
            lastClosePrice: lastClosePrice,
            tokenError: tokenError,
            currentRequestToken: currentRequestToken
          });
        });
      } else {
        res.render('admin', { 
          contests: contests || [],
          activeContest: null,
          predictions: [],
          currentPrice: currentNiftyPrice,
          isTokenValid: isTokenValid,
          lastClosePrice: lastClosePrice,
          tokenError: tokenError,
          currentRequestToken: currentRequestToken
        });
      }
    });
  });
});

app.post('/admin/new-contest', requireAdmin, (req, res) => {
  const { contestName } = req.body;
  
  db.run('UPDATE contests SET is_active = 0', (err) => {
    db.run('INSERT INTO contests (name, is_active) VALUES (?, 1)', [contestName || 'New Contest'], (err) => {
      res.redirect('/admin');
    });
  });
});

app.post('/admin/delete-prediction/:id', requireAdmin, (req, res) => {
  db.run('DELETE FROM predictions WHERE id = ?', [req.params.id], (err) => {
    res.redirect('/admin');
  });
});

app.post('/admin/bulk-upload', requireAdmin, upload.single('csvFile'), (req, res) => {
  if (!req.file) {
    return res.redirect('/admin');
  }

  db.get('SELECT * FROM contests WHERE is_active = 1', (err, contest) => {
    if (!contest) {
      fs.unlinkSync(req.file.path);
      return res.redirect('/admin');
    }

    const results = [];
    fs.createReadStream(req.file.path)
      .pipe(parse({ columns: false, skip_empty_lines: true }))
      .on('data', (data) => {
        if (data.length >= 2) {
          const name = data[0].trim();
          const value = parseFloat(data[1]);
          
          if (name && !isNaN(value)) {
            if (lastClosePrice) {
              const maxChange = lastClosePrice * 0.3;
              const minValue = lastClosePrice - maxChange;
              const maxValue = lastClosePrice + maxChange;
              
              if (value >= minValue && value <= maxValue) {
                results.push([contest.id, name, value]);
              }
            } else {
              results.push([contest.id, name, value]);
            }
          }
        }
      })
      .on('end', () => {
        if (results.length > 0) {
          const stmt = db.prepare('INSERT INTO predictions (contest_id, name, predicted_value) VALUES (?, ?, ?)');
          results.forEach(row => {
            stmt.run(row);
          });
          stmt.finalize();
        }
        fs.unlinkSync(req.file.path);
        res.redirect('/admin');
      });
  });
});

app.post('/admin/refresh-token', requireAdmin, async (req, res) => {
  const { requestToken } = req.body;
  const result = await generateAccessToken(requestToken);
  if (result.success) {
    fetchNiftyPrice();
  }
  res.json({ 
    success: result.success, 
    isTokenValid,
    error: result.error,
    accessToken: result.accessToken 
  });
});

app.post('/admin/update-access-token', requireAdmin, async (req, res) => {
  const { accessTokenInput } = req.body;
  if (accessTokenInput) {
    accessToken = accessTokenInput;
    isTokenValid = true;
    tokenError = null;
    
    fs.readFile('.env', 'utf8', (err, data) => {
      if (err) return;
      const updatedEnv = data.replace(
        /KITE_ACCESS_TOKEN=.*/,
        `KITE_ACCESS_TOKEN=${accessToken}`
      );
      fs.writeFile('.env', updatedEnv, (err) => {
        if (err) console.error('Error updating .env:', err);
      });
    });
    
    fetchNiftyPrice();
    res.json({ success: true, message: 'Access token updated successfully' });
  } else {
    res.json({ success: false, message: 'Access token is required' });
  }
});

app.post('/admin/start-fetching', requireAdmin, (req, res) => {
  if (accessToken && accessToken !== 'your_access_token_here') {
    fetchNiftyPrice();
    res.json({ success: true, message: 'Started fetching prices' });
  } else {
    res.json({ success: false, message: 'Please configure access token first' });
  }
});

app.get('/admin/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});