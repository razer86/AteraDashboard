require('dotenv').config();
const express = require('express');
const app = express();
const PORT = 3001;

// Patch for fetch in Node.js <18
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

app.use(express.static('public'));

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

app.listen(PORT, () => {
  console.log(`Proxy and static server running on http://localhost:${PORT}`);
});

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
  