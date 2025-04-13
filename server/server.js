// Load required Node.js modules
import express from 'express';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';

// Init dotenv
dotenv.config();

// Setup __dirname manually (not available in ESM)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Fetch Dashboard Version
let pkg = { version: 'unknown' };
try {
  pkg = JSON.parse(readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
} catch (err) {
  console.warn('Could not load version info from package.json:', err.message);
}

// Set app type and port
const app = express();
const PORT = 3001;

// Check for Atera API key
if (!process.env.ATERA_API_KEY) {
  console.error('[!] ATERA_API_KEY is missing from .env file.');
  console.error('    Please create a .env file with your API key:');
  console.error('    ATERA_API_KEY=your-api-key-here');
  process.exit(1);
}

// Serve static files
app.use(express.static(path.join(__dirname, '..', 'public')));

// Serve index.html for the root path
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Alerts API
app.get('/api/alerts', async (req, res) => {
  try {
    const response = await fetch('https://app.atera.com/api/v3/alerts', {
      headers: {
        'X-Api-Key': process.env.ATERA_API_KEY,
        'Accept': 'application/json'
      }
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Fetch error:', err);
    res.status(500).send('API error');
  }
});

// Customers API (with pagination)
app.get('/api/customers', async (req, res) => {
  const allCustomers = [];
  let page = 1;
  let totalPages = 1;

  try {
    do {
      const response = await fetch(`https://app.atera.com/api/v3/customers?page=${page}&itemsInPage=100`, {
        headers: {
          'X-Api-Key': process.env.ATERA_API_KEY,
          'Accept': 'application/json'
        }
      });

      const data = await response.json();

      if (page === 1 && data.totalPages) {
        totalPages = data.totalPages;
      }

      allCustomers.push(...data.items);
      page++;
    } while (page <= totalPages);

    res.json({ items: allCustomers });
  } catch (err) {
    console.error('Fetch error:', err);
    res.status(500).send('API error');
  }
});

// Get Customer Branch custom field value
app.get('/api/customers/:id/branch', async (req, res) => {
  const { id } = req.params;
  const fieldName = 'Branch'; // Or make this dynamic later

  try {
    const response = await fetch(`https://app.atera.com/api/v3/customvalues/customerfield/${id}/${encodeURIComponent(fieldName)}`, {
      headers: {
        'X-Api-Key': process.env.ATERA_API_KEY,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch branch: ${response.status}`);
    }

    const data = await response.json();
    res.json({ branch: data.Value || null });
  } catch (err) {
    console.error(`Branch fetch failed for customer ${id}`, err.message);
    res.status(500).json({ branch: null, error: 'Branch lookup failed' });
  }
});



// Provide a Health Checking endpoint
app.get('/api/health', (req, res) => {
  const hasKey = Boolean(process.env.ATERA_API_KEY);
  res.json({
    status: 'ok',
    apiKeyLoaded: hasKey,
    timestamp: new Date().toISOString()
  });
});

// Provide a Version reporting endpoint
app.get('/api/version', (req, res) => {
  res.json({ version: pkg.version });
});


// Launch Server
app.listen(PORT, () => {
  console.log(`✅ Dashboard running at http://localhost:${PORT}`);
});
