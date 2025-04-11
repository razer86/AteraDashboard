const refreshRate = document.getElementById('refreshRate');
const alertsDiv = document.getElementById('alerts');

let refreshInterval;
let allCustomers = [];
let customerLogos = {};
let seenAlertIds = new Set();

// === Fetch Customers
async function populateCustomerCheckboxes() {
    const res = await fetch('/api/customers');
    const data = await res.json();
    allCustomers = data.items;
    customerLogos = {};
    allCustomers.forEach(c => {
        if (c.Logo) {
            customerLogos[c.CustomerID] = c.Logo;
        }
    });

    allCustomers.sort((a, b) => a.CustomerName.localeCompare(b.CustomerName));
  
    renderCustomerCheckboxes();
}

// === Fetch Alerts
async function fetchAlerts() {
    try {
      const res = await fetch('/api/alerts');
      const data = await res.json();

      renderAlerts(data.items);
    } catch (err) {
      console.error('Failed to fetch alerts', err);
      alertsDiv.innerHTML = `<div style="color:red;">Failed to load alerts.</div>`;
    }
  }
  
// === Render Customer List
function renderCustomerCheckboxes(filter = '') {
    const saved = JSON.parse(localStorage.getItem('selectedCustomers') || '[]');
    const container = document.getElementById('customerCheckboxes');
    
    const filtered = allCustomers.filter(c =>
        c.CustomerName.toLowerCase().includes(filter.toLowerCase())
    );
    
    container.innerHTML = filtered.map(c => {
        const checked = saved.includes(c.CustomerID) ? 'checked' : '';
        return `<label><input type="checkbox" value="${c.CustomerID}" ${checked}> ${c.CustomerName}</label>`;
    }).join('');
    
    container.querySelectorAll('input[type=checkbox]').forEach(cb => {
        cb.addEventListener('change', (e) => {
            let saved = JSON.parse(localStorage.getItem('selectedCustomers') || '[]');
            const id = Number(cb.value);
          
            if (cb.checked) {
              // Add if not already in list
              if (!saved.includes(id)) saved.push(id);
            } else {
              // Remove if unchecked
              saved = saved.filter(x => x !== id);
            }
          
            localStorage.setItem('selectedCustomers', JSON.stringify(saved));
            updateCustomerStats();
            fetchAlerts();
          });
          
    });
    
    updateCustomerStats();
}

// === Update Customer selection count
function updateCustomerStats() {
    const total = allCustomers.length;
    const selected = JSON.parse(localStorage.getItem('selectedCustomers') || '[]').length;
    const statsLine = `Customers: ${total} total, ${selected} selected`;
    document.getElementById('customerStats').textContent = statsLine;
}
  
  

// === Render Filtered + Sorted Alerts ===
function renderAlerts(alerts) {
    const selected = JSON.parse(localStorage.getItem('selectedCustomers') || '[]');
    const filtered = alerts
      .filter(a => selected.includes(a.CustomerID))
      .sort((a, b) => new Date(b.Created) - new Date(a.Created));
  
    alertsDiv.innerHTML = `
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <thead>
          <tr style="text-align: left; border-bottom: 1px solid #ccc;">
            <th>Customer</th>
            <th>Alert</th>
            <th>Device</th>
            <th>Created</th>
            <th>Severity</th>
            <th>Category</th>
          </tr>
        </thead>
        <tbody>
          ${filtered.map((a, index) => `
            <tr
                style="
                border-bottom: 1px solid #eee;
                vertical-align: top;
                cursor: pointer;
                ${index % 2 === 1 ? 'background-color: #fafafa;' : ''}
                ${!seenAlertIds.has(a.AlertID) ? 'animation: flashRow 1s ease-in-out;' : ''}
                "
                onclick="window.open('https://app.atera.com/new/rmm/device/${a.DeviceGuid}/${a.AgentId ? 'agent' : 'snmp'}', '_blank')"
            >

            <td style="padding: 6px 8px; display: flex; align-items: center; gap: 8px;">
            ${customerLogos[a.CustomerID]
            ? `<img src="${customerLogos[a.CustomerID]}" alt="logo" style="width: 24px; height: 24px; border-radius: 4px;">`
            : `<div style="
                    width: 24px;
                    height: 24px;
                    background-color: #ccc;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 12px;
                    color: white;
                    font-weight: bold;
                ">${getCustomerInitials(a.CustomerName)}</div>`
            }

            <a href="https://app.atera.com/new/customer/${a.CustomerID}" target="_blank" onclick="event.stopPropagation()" style="color: #007bff; text-decoration: none;">
                ${a.CustomerName}
            </a>
            </td>

            <td style="padding: 6px 8px;">
                <strong>${a.Title}</strong><br>${a.AlertMessage}
            </td>
            <td style="padding: 6px 8px;">
            <a
                href="https://app.atera.com/new/rmm/device/${a.DeviceGuid}/${a.AgentId ? 'agent' : 'snmp'}"
                target="_blank"
                onclick="event.stopPropagation()"
                style="color: #007bff; text-decoration: none;"
            >
                ${a.DeviceName}
            </a>
            </td>
            <td style="padding: 6px 8px;">${formatRelativeTime(a.Created)}</td>
            <td style="padding: 6px 8px;">
                <span style="padding: 2px 8px; border-radius: 8px; background-color: ${severityColorBg(a.Severity)}; color: ${severityColor(a.Severity)};">
                ${a.Severity}
                </span>
            </td>
            <td style="padding: 6px 8px;">${a.AlertCategoryID}</td>
            </tr>


          `).join('')}
        </tbody>
      </table>
    `;
    // Update the Seen Alerts
    filtered.forEach(a => seenAlertIds.add(a.AlertID));

}

// === Calculate time since alert
function formatRelativeTime(dateString) {
    const diff = Math.floor((Date.now() - new Date(dateString)) / 60000); // in minutes
    if (diff < 1) return "Just now";
    if (diff === 1) return "1 min ago";
    if (diff < 60) return `${diff} mins ago`;
    const hours = Math.floor(diff / 60);
    return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
}
    
// === Button: Select All Customers
function selectAllCustomers() {
    const allIds = allCustomers.map(c => c.CustomerID);
    localStorage.setItem('selectedCustomers', JSON.stringify(allIds));
  
    // Reflect selection in the current (filtered) DOM
    document.querySelectorAll('#customerCheckboxes input[type=checkbox]').forEach(cb => cb.checked = true);
  
    updateCustomerStats();
    fetchAlerts();
  }

  // === Button: Deselect All Customers
function deselectAllCustomers() {
    localStorage.setItem('selectedCustomers', JSON.stringify([]));

    document.querySelectorAll('#customerCheckboxes input[type=checkbox]').forEach(cb => cb.checked = false);

    updateCustomerStats();
    fetchAlerts();
}
   
// === Severity Coloring 
function severityColor(severity) {
  switch (severity) {
    case "Critical": return "red";
    case "Warning": return "orange";
    case "Info": return "blue";
    default: return "black";
  }
}

function severityColorBg(severity) {
  switch (severity) {
    case "Critical": return "#ffe5e5";
    case "Warning": return "#fff3cd";
    case "Info": return "#e6f0ff";
    default: return "#f0f0f0";
  }
}

// === Handle Refresh Rate Changes
refreshRate.addEventListener('change', () => {
    clearInterval(refreshInterval);
    refreshInterval = setInterval(fetchAlerts, Number(refreshRate.value));
    startCountdown();
  });
  

// === Refresh Rate Countdown
let countdownSeconds = Number(refreshRate.value) / 1000;
const countdownDisplay = document.getElementById('refreshCountdown');
let countdownInterval;

function startCountdown() {
  clearInterval(countdownInterval);
  countdownSeconds = Number(refreshRate.value) / 1000;
  updateCountdownUI();

  countdownInterval = setInterval(() => {
    countdownSeconds--;
    if (countdownSeconds <= 0) {
      countdownSeconds = Number(refreshRate.value) / 1000;
    }
    updateCountdownUI();
  }, 1000);
}

function updateCountdownUI() {
  countdownDisplay.textContent = `Refreshing in: ${countdownSeconds}s`;
}

// === Generate Customer initials
function getCustomerInitials(name) {
    if (!name) return '?';
    const parts = name.split(' ');
    return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
  }
  


// === Init
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('customerSearch').addEventListener('input', (e) => {
        renderCustomerCheckboxes(e.target.value);
      });
    populateCustomerCheckboxes();  // only on load
    fetchAlerts();                 // show first alerts
    refreshInterval = setInterval(fetchAlerts, Number(refreshRate.value));
    startCountdown();

  });
  