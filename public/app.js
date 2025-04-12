// === Global Variables ===
let allCustomers = [];
let customerLogos = {};
let customerBranchCache = {};
let branchLookupsEnabled = false;
let branchRequestQueue = [];
let branchLookupInProgress = false;
let requestDelay = 400;
let consecutiveSuccesses = 0;
const minDelay = 150;
const maxDelay = 2000;
const countdownTickInterval = 1000;
let countdownInterval;
let countdownSeconds;
let refreshInterval;
let seenAlertIds = new Set();


// === Utility Functions ===

// === Safe API Wrapper ===
async function safeFetch(url, options = {}) {
  const res = await fetch(url, options);
  if (res.status === 429) {
    console.warn(`Rate limit hit for ${url}`);
    throw new Error('Rate limited');
  }
  return res;
}

function getSelectedCustomerIds() {
  return JSON.parse(localStorage.getItem('selectedCustomers') || '[]');
}

function renderCustomerCheckbox(c, branch = null) {
  const saved = getSelectedCustomerIds();
  const checked = saved.includes(c.CustomerID) ? 'checked' : '';
  const branchLabel = branch ? ` (${branch})` : '';
  return `<input type="checkbox" value="${c.CustomerID}" ${checked}> ${c.CustomerName}${branchLabel}`;
}

function attachCheckboxHandler(cb) {
  cb.addEventListener('change', () => {
    let saved = getSelectedCustomerIds();
    const id = Number(cb.value);
    if (cb.checked) {
      if (!saved.includes(id)) saved.push(id);
    } else {
      saved = saved.filter(x => x !== id);
    }
    localStorage.setItem('selectedCustomers', JSON.stringify(saved));
    updateCustomerStats();
    fetchAlerts();
  });
}

function queueBranchLookup(customerId, callback) {
  branchRequestQueue.push({ customerId, callback });
  processBranchQueue();
}

function processBranchQueue() {
  if (branchLookupInProgress || branchRequestQueue.length === 0) return;
  branchLookupInProgress = true;
  const { customerId, callback } = branchRequestQueue.shift();
  getCustomerBranch(customerId).then(branch => {
    callback(branch);
    consecutiveSuccesses++;
    if (consecutiveSuccesses >= 5 && requestDelay > minDelay) {
      requestDelay = Math.max(minDelay, requestDelay - 50);
      consecutiveSuccesses = 0;
    }
    setTimeout(() => {
      branchLookupInProgress = false;
      processBranchQueue();
    }, requestDelay);
  }).catch(err => {
    if (err.status === 429) {
      requestDelay = Math.min(maxDelay, requestDelay + 300);
    }
    setTimeout(() => {
      branchLookupInProgress = false;
      processBranchQueue();
    }, requestDelay);
  });
}

async function getCustomerBranch(customerId) {
  if (customerBranchCache[customerId]) return customerBranchCache[customerId];
  const res = await safeFetch(`/api/customers/${customerId}/branch`);
  const data = await res.json();
  const branch = data.branch || null;
  customerBranchCache[customerId] = branch;
  return branch;
}

function updateCustomerStats() {
  const total = allCustomers.length;
  const selected = getSelectedCustomerIds().length;
  document.getElementById('customerStats').textContent = `Customers: ${total} total, ${selected} selected`;
}

function formatRelativeTime(timestamp) {
  const seconds = Math.floor((new Date() - new Date(timestamp)) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function severityColor(sev) {
  return sev === 'Critical' ? 'var(--severity-critical)' : sev === 'Warning' ? 'var(--severity-warning)' : 'var(--severity-info)';
}

function severityColorBg(sev) {
  return sev === 'Critical' ? 'var(--severity-critical-bg)' : sev === 'Warning' ? 'var(--severity-warning-bg)' : 'var(--severity-info-bg)';
}

function getCustomerInitials(name) {
  const parts = name.trim().split(' ');
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
}

function renderCustomerCheckboxes(filter = '') {
  const saved = getSelectedCustomerIds();
  const container = document.getElementById('customerCheckboxes');
  const filtered = allCustomers.filter(c => c.CustomerName.toLowerCase().includes(filter.toLowerCase()));

  container.innerHTML = filtered.map(c => {
    const labelId = `customerLabel-${c.CustomerID}`;
    return `<label id="${labelId}">${renderCustomerCheckbox(c)}</label>`;
  }).join('');

  filtered.forEach(c => {
    if (!branchLookupsEnabled) return;
    queueBranchLookup(c.CustomerID, (branch) => {
      const label = document.getElementById(`customerLabel-${c.CustomerID}`);
      if (label) {
        label.innerHTML = renderCustomerCheckbox(c, branch);
        attachCheckboxHandler(label.querySelector('input[type="checkbox"]'));
      }
    });
  });

  container.querySelectorAll('input[type=checkbox]').forEach(attachCheckboxHandler);
  updateCustomerStats();
}

function selectAllCustomers() {
  localStorage.setItem('selectedCustomers', JSON.stringify(allCustomers.map(c => c.CustomerID)));
  renderCustomerCheckboxes(document.getElementById('customerSearch').value);
}

function deselectAllCustomers() {
  localStorage.setItem('selectedCustomers', JSON.stringify([]));
  renderCustomerCheckboxes(document.getElementById('customerSearch').value);
}

function selectFilteredCustomers() {
  const saved = getSelectedCustomerIds();
  const container = document.getElementById('customerCheckboxes');
  const checkboxes = container.querySelectorAll('input[type="checkbox"]');

  checkboxes.forEach(cb => {
    cb.checked = true;
    const id = Number(cb.value);
    if (!saved.includes(id)) saved.push(id);
  });

  localStorage.setItem('selectedCustomers', JSON.stringify(saved));
  updateCustomerStats();
  fetchAlerts();
}

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
  }, countdownTickInterval);
}

function updateCountdownUI() {
  const box = document.getElementById('refreshCountdownBox');
  if (box) {
    box.textContent = `🔄 Refreshing in: ${countdownSeconds}s`;
  }
}

function applyTheme(isDark) {
  document.body.classList.toggle('dark-mode', isDark);
  localStorage.setItem('darkMode', isDark);
  const box = document.getElementById('darkModeToggleBox');
  if (box) box.textContent = isDark ? '🌙' : '☀️';
}


function setupDarkModeToggle() {
  const toggleContainer = document.createElement('div');
  toggleContainer.id = 'darkModeToggleBox';
  toggleContainer.title = 'Toggle Dark Mode';
  toggleContainer.style.position = 'fixed';
  toggleContainer.style.bottom = '10px';
  toggleContainer.style.right = '10px';
  toggleContainer.style.cursor = 'pointer';
  toggleContainer.style.padding = '8px';
  toggleContainer.style.borderRadius = '6px';
  toggleContainer.style.background = '#eee';
  toggleContainer.style.boxShadow = '0 1px 4px rgba(0,0,0,0.2)';
  toggleContainer.style.zIndex = '9999';
  toggleContainer.textContent = '☀️';
  toggleContainer.addEventListener('mouseenter', () => toggleContainer.style.opacity = 0.8);
  toggleContainer.addEventListener('mouseleave', () => toggleContainer.style.opacity = 0.5);

  document.body.appendChild(toggleContainer);

  const saved = localStorage.getItem('darkMode');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = saved !== null ? saved === 'true' : prefersDark;
  applyTheme(isDark);
  toggleContainer.textContent = isDark ? '🌙' : '☀️';

  toggleContainer.addEventListener('click', () => {
    const nowDark = document.body.classList.toggle('dark-mode');
    toggleContainer.textContent = nowDark ? '🌙' : '☀️';
    localStorage.setItem('darkMode', nowDark);
  });
}

// === Alerts ===
function renderAlerts(alerts) {
  const selected = getSelectedCustomerIds();
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
        ${filtered.map(a => `
          <tr
            style="border-bottom: 1px solid #eee; vertical-align: top; cursor: pointer; ${!seenAlertIds.has(a.AlertID) ? 'animation: flashRow 1s ease-in-out;' : ''}"
            onclick="window.open('https://app.atera.com/new/rmm/device/${a.DeviceGuid}/${a.AgentId ? 'agent' : 'snmp'}', '_blank')">

            <td style="padding: 6px 8px; display: flex; align-items: center; gap: 8px;">
              ${customerLogos[a.CustomerID]
                ? `<img src="${customerLogos[a.CustomerID]}" alt="logo" style="width: 24px; height: 24px; border-radius: 4px;">`
                : `<div style="width: 24px; height: 24px; background-color: #ccc; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; color: white; font-weight: bold;">
                    ${getCustomerInitials(a.CustomerName)}
                  </div>`}
              <a href="https://app.atera.com/new/customer/${a.CustomerID}" target="_blank" onclick="event.stopPropagation()" style="color: var(--link-color); text-decoration: none;">
                ${a.CustomerName}
              </a>
            </td>

            <td style="padding: 6px 8px;"><strong>${a.Title}</strong><br>${a.AlertMessage}</td>
            <td style="padding: 6px 8px;">
              <a href="https://app.atera.com/new/rmm/device/${a.DeviceGuid}/${a.AgentId ? 'agent' : 'snmp'}" target="_blank" onclick="event.stopPropagation()" style="color: var(--link-color); text-decoration: none;">
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
          </tr>`).join('')}
      </tbody>
    </table>`;

  filtered.forEach(a => seenAlertIds.add(a.AlertID));
  console.log("Filtered alerts:", filtered);

}

async function fetchAlerts() {
  try {
    const res = await safeFetch('/api/alerts');
    if (!res.ok) throw new Error(`Server responded with ${res.status}`);
    const data = await res.json();
    renderAlerts(data.items);
    populateCustomerCheckboxes(); // Will only re-render if something changed

  } catch (err) {
    console.error('Failed to fetch alerts', err);
    alertsDiv.innerHTML = `<div style="color: red;">Failed to load alerts. This may be due to a missing or invalid Atera API key on the server.</div>`;
  }
  // console.log("Fetching alerts...");
  // console.log("Selected customers:", getSelectedCustomerIds());

}

async function populateCustomerCheckboxes(force = false) {
  try {
    const res = await safeFetch('/api/customers');
    if (!res.ok) throw new Error(`Server responded with ${res.status}`);
    const data = await res.json();

    // Skip re-rendering if data is identical and not forced
    const namesOnly = data.items.map(c => c.CustomerName).join(',');
    const current = allCustomers.map(c => c.CustomerName).join(',');
    if (!force && namesOnly === current) return;

    allCustomers = data.items.sort((a, b) => a.CustomerName.localeCompare(b.CustomerName));

    customerLogos = {};
    allCustomers.forEach(c => {
      if (c.Logo) customerLogos[c.CustomerID] = c.Logo;
    });

    renderCustomerCheckboxes(document.getElementById('customerSearch').value);
  } catch (err) {
    console.error('Failed to fetch customer list:', err);
    document.getElementById('customerCheckboxes').innerHTML = `<div style="color: red;">Failed to load customer list. This may be due to a missing or invalid Atera API key on the server.</div>`;
  }
}

// === On Page Load ===
document.addEventListener('DOMContentLoaded', () => {
  refreshRate.addEventListener('change', () => {
    clearInterval(refreshInterval);
    refreshInterval = setInterval(fetchAlerts, Number(refreshRate.value));
    startCountdown();
  });

  const savedToggle = localStorage.getItem('branchLookupsEnabled');
  branchLookupsEnabled = savedToggle === null ? false : savedToggle === 'true';
  document.getElementById('toggleBranchLookup').checked = branchLookupsEnabled;
  document.getElementById('toggleBranchLookup').addEventListener('change', (e) => {
    branchLookupsEnabled = e.target.checked;
    localStorage.setItem('branchLookupsEnabled', branchLookupsEnabled);
    renderCustomerCheckboxes(document.getElementById('customerSearch').value);
  });

  document.getElementById('customerSearch').addEventListener('input', e => {
    renderCustomerCheckboxes(e.target.value);
  });

  setupDarkModeToggle();

  populateCustomerCheckboxes();
  fetchAlerts();
  refreshInterval = setInterval(fetchAlerts, Number(refreshRate.value));
  startCountdown();

  fetch('/api/version')
    .then(res => res.json())
    .then(data => {
      document.getElementById('refreshCountdownBox').textContent += ` | v${data.version}`;
    });
});
