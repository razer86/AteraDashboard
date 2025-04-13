// === Global Variables ===
let allCustomers = [];                            // Customer list
let customerLogos = {};                           // Customer logo urls
let customerBranchCache = {};                     // Customer branch (if assigned)
let branchLookupsEnabled = false;                 // Enable/Disable Customer branch lookup
let branchRequestQueue = [];                      // API request throttling queue for Branch lookups
let branchLookupInProgress = false;               // Are we currently performing a throttled lookup
let requestDelay = 400;                           // Delay between API requests
let consecutiveSuccesses = 0;                     // Number of consecutive successful API returns, used to dynamically adjust throttle
const minDelay = 150;                             // Minimum delay to add if we are being throttled
const maxDelay = 2000;                            // Maximum delay to add if we are being throttled
const countdownTickInterval = 1000;               // How often do we refresh the refresh countdown box (milliseconds)
let countdownInterval;                            // ID of the interval timer that updates the on-screen refresh countdown
let countdownSeconds;                             // Seconds left to refresh
let refreshInterval;                              // Selected refresh duration
let seenAlertIds = new Set();                     // Track alerts for new alert flash


// === Utility Functions ===

// Create wrapper for fetch calls to check API return for rate limit error code
async function safeFetch(url, options = {}) {
  const res = await fetch(url, options);
  if (res.status === 429) {                       
    console.warn(`Rate limit hit for ${url}`);
    throw new Error('Rate limited');
  }
  return res;                                     
}

// Return the Customer ID for the selected customer for the local cache
function getSelectedCustomerIds() {
  return JSON.parse(localStorage.getItem('selectedCustomers') || '[]');
}

// Generate the Customer list checkbox, preserve checkbox state and branch label
function renderCustomerCheckbox(c, branch = null) {
  const saved = getSelectedCustomerIds();
  const checked = saved.includes(c.CustomerID) ? 'checked' : '';
  const branchLabel = branch ? ` (${branch})` : '';
  return `<input type="checkbox" value="${c.CustomerID}" ${checked}> ${c.CustomerName}${branchLabel}`;
}

// Handle Customer checkbox change events
function attachCheckboxHandler(cb) {
  cb.addEventListener('change', () => {
    let saved = getSelectedCustomerIds();                                   // Track selected customers
    const id = Number(cb.value);       

    if (cb.checked) {                                                       // If checked, store the Customer ID
      if (!saved.includes(id)) saved.push(id);
    } else {
      saved = saved.filter(x => x !== id);
    }

    localStorage.setItem('selectedCustomers', JSON.stringify(saved));       // Update checked Customer ID list to local storage
    updateCustomerStats();                                                  // Update customer total/selected label
    fetchAlerts();                                                          // Update alerts list
  });
}

// Send Branch lookup requests to the queue handler
function queueBranchLookup(customerId, callback) {
  branchRequestQueue.push({ customerId, callback });
  processBranchQueue();
}

// Dynamically adjust API query rate for Branch lookups
function processBranchQueue() {
  if (branchLookupInProgress || branchRequestQueue.length === 0) return;                                        // Prevent overlapping lookups or empty queue
  branchLookupInProgress = true;

  const { customerId, callback } = branchRequestQueue.shift();

  getCustomerBranch(customerId).then(branch => {                                                                // Perform customer query
    callback(branch);
    consecutiveSuccesses++;

    if (consecutiveSuccesses >= 5 && requestDelay > minDelay) {                                                 // If 5 successful requests in a row and delay above minimum, speed up
      requestDelay = Math.max(minDelay, requestDelay - 50);                                                     // Reduce by 50ms
      consecutiveSuccesses = 0;
    }

    setTimeout(() => {                                                                                          // Wait for delay timer
      branchLookupInProgress = false;                                                                           // Allow next item to be processed
      processBranchQueue();                                                                                     // Continue processing queue
    }, requestDelay);

  }).catch(err => {
    if (err.status === 429) {                                                                                   // Rate limited
      requestDelay = Math.min(maxDelay, requestDelay + 300);                                                    // Increase delay by 300ms
    }

    setTimeout(() => {                                                                                          // Wait for delay timer
      branchLookupInProgress = false;                                                                           // Allow next item to be processed
      processBranchQueue();                                                                                     // Continue processing queue
    }, requestDelay);                                                     
  });
}

// Use the safeFetch handler to get the Customer Branch
async function getCustomerBranch(customerId) {
  if (customerBranchCache[customerId]) return customerBranchCache[customerId];                                  // Check if we already have the branch cached for the customer
  const res = await safeFetch(`/api/customers/${customerId}/branch`);                                           // Fetch branch custom field
  const data = await res.json();
  const branch = data.branch || null;                                                                           // Extract branch from fetch return
  customerBranchCache[customerId] = branch;                                                                     // Cache branch
  return branch;
}

// Handle the Customer Total/Selected label
function updateCustomerStats() {
  const total = allCustomers.length;                                                                            // Total customer count
  const selected = getSelectedCustomerIds().length;                                                             // Total selected customer count 
  document.getElementById('customerStats').textContent = `Customers: ${total} total, ${selected} selected`;     //Update label
}

// Convert Alert time to eplased time
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

// Set Alert severity label font colour
function severityColor(sev) {
  return sev === 'Critical' ? 'var(--severity-critical)' : sev === 'Warning' ? 'var(--severity-warning)' : 'var(--severity-info)';
}

// Set Alert severity label background colour
function severityColorBg(sev) {
  return sev === 'Critical' ? 'var(--severity-critical-bg)' : sev === 'Warning' ? 'var(--severity-warning-bg)' : 'var(--severity-info-bg)';
}

// Generate customer initals for customers that do dont have a logo
function getCustomerInitials(name) {
  const parts = name.trim().split(' ');
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
}

// Update the Customer list checkbox
function renderCustomerCheckboxes(filter = '') {
  const saved = getSelectedCustomerIds();                                                                         // Retrieve the list of selected customers
  const container = document.getElementById('customerCheckboxes');                                                // Link to the container element
  const filtered = allCustomers.filter(c => c.CustomerName.toLowerCase().includes(filter.toLowerCase()));         // Maintain a list of the customers visible when filtering the list

  container.innerHTML = filtered.map(c => {                                                                       // Update list to only show filtered customers
    const labelId = `customerLabel-${c.CustomerID}`;                                                              // Set label using Customer ID
    return `<label id="${labelId}">${renderCustomerCheckbox(c)}</label>`;                                         // Update checkbox element text
  }).join('');

  filtered.forEach(c => {
    if (!branchLookupsEnabled) return;                                                                            // Check if Branch Lookups are enabled
    queueBranchLookup(c.CustomerID, (branch) => {                                                                 // Retrieve the branch text by the Customer ID
      const label = document.getElementById(`customerLabel-${c.CustomerID}`);                                     
      if (label) {                                                                                               
        label.innerHTML = renderCustomerCheckbox(c, branch);                                                      // Append the Branch string to the end of the customer name
        attachCheckboxHandler(label.querySelector('input[type="checkbox"]'));                                     // Update checkbox element text
      }
    });
  });

  container.querySelectorAll('input[type=checkbox]').forEach(attachCheckboxHandler);                              // Register the change handler for each item in the checkbox list

  updateCustomerStats();                                                                                          // Update Customer Total/Selected label
}

// Button: Selecte all Customers
function selectAllCustomers() {
  localStorage.setItem('selectedCustomers', JSON.stringify(allCustomers.map(c => c.CustomerID)));                 // Update selection changes to local storage
  renderCustomerCheckboxes(document.getElementById('customerSearch').value);                                      // Update checkbox
}

//Button: Deselect all Customers
function deselectAllCustomers() {
  localStorage.setItem('selectedCustomers', JSON.stringify([]));                                                  // Update selection changes to local storage
  renderCustomerCheckboxes(document.getElementById('customerSearch').value);                                      // Update checkbox
}

// Button: Select All Filtered Customers
function selectFilteredCustomers() {
  const saved = getSelectedCustomerIds();                                                                         // List the Customer ID's for each currently selected Customer
  const container = document.getElementById('customerCheckboxes');                                                // Link to the container element
  const checkboxes = container.querySelectorAll('input[type="checkbox"]');                                        // List the Customers visivle in the checkbox list

  checkboxes.forEach(cb => {
    cb.checked = true;                                                                                            // Set the checkbox to selected
    const id = Number(cb.value);                                                                                  // Get Customer ID
    if (!saved.includes(id)) saved.push(id);                                                                      // Check if the customer is already in the saved list, and add if not
  });

  localStorage.setItem('selectedCustomers', JSON.stringify(saved));                                               // Save selected customers to local storage
  updateCustomerStats();                                                                                          // Update Customer Total/Selected label 
  fetchAlerts();                                                                                                  // Update alerts list
}

// Create internal countdown timer
function startCountdown() {
  clearInterval(countdownInterval);                                                                               // Stop any existing timer
  countdownSeconds = Number(refreshRate.value) / 1000;                                                            // Set the countdown value (converted to seconds)
  updateCountdownUI();                                                                                            // Update on the onscreen countdown box

  countdownInterval = setInterval(() => {                                                                         // Start a new timer
    countdownSeconds--;                                                                                           // Decrement timer value
    if (countdownSeconds <= 0) {                                                                                  
      countdownSeconds = Number(refreshRate.value) / 1000;                                                        // Timer finished, reset to select refresh rate
    }
    updateCountdownUI();                                                                                          // Update on the onscreen countdown box
  }, countdownTickInterval);                                                                                      
}

// Update the text in the onscreen 'Refreshing In' box
function updateCountdownUI() {
  const box = document.getElementById('refreshCountdownBox');
  if (box) {
    box.textContent = `🔄 Refreshing in: ${countdownSeconds}s`;
  }
}

// Apply Dark/Light Mode theme settings
function applyTheme(isDark) {
  document.body.classList.toggle('dark-mode', isDark);                                                             // Update the toggle state
  localStorage.setItem('darkMode', isDark);                                                                        // Save theme state to local storage
  const box = document.getElementById('darkModeToggleBox');                                                        // Link to onscreen toggle button
  if (box) box.textContent = isDark ? '🌙' : '☀️';                                                                // Swap the icon in the onscreen button
}

// Create the Onscreen button
function setupDarkModeToggle() {
  const toggleContainer = document.createElement('div');                                                           // Link to html div element
  toggleContainer.id = 'darkModeToggleBox';                                                                        // Set the styling
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
  toggleContainer.addEventListener('mouseenter', () => toggleContainer.style.opacity = 0.8);                        // Register for Mouseover event
  toggleContainer.addEventListener('mouseleave', () => toggleContainer.style.opacity = 0.5);                        // Regsiter for Mouseleave event

  document.body.appendChild(toggleContainer);                                                                       // Setup toggle

  const saved = localStorage.getItem('darkMode');                                                                   // Check local storage for previous theme state
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;                                    // Check if the user prefers darkmode for the current browser
  const isDark = saved !== null ? saved === 'true' : prefersDark;                                                   // Set to dark mode if value in local storage, or browser already in dark mode
  applyTheme(isDark);                                                                                               // Set theme
  toggleContainer.textContent = isDark ? '🌙' : '☀️';                                                              // Set button icon according to theme

  toggleContainer.addEventListener('click', () => {                                                                 // Register button for clicks
    const nowDark = document.body.classList.toggle('dark-mode');                                                    
    toggleContainer.textContent = nowDark ? '🌙' : '☀️';                                                           // Get state of button
    localStorage.setItem('darkMode', nowDark);                                                                      // Save theme selection to local storage
  });
}

// Alerts list
function renderAlerts(alerts) {
  const selected = getSelectedCustomerIds();                                                                        // List of selected customers
  const filtered = alerts                                                                                           // Filter received alerts by selected customers
    .filter(a => selected.includes(a.CustomerID))
    .sort((a, b) => new Date(b.Created) - new Date(a.Created));                                                     // Sort alerts by date created

  // Generate the Alerts table
  // Make full page with and set font size
  // Set column headers
  // Use the filtered alerts list
  // Set mouse over animation for each row
  // Set click action to open the device in Atera
  // Add the customer logo or initial to the Customer Name
  // Set the click action of the customer name to go to the customer in Atera
  // Set the alert title to bold
  // Send device clicks to Atera device page
  // Render the alert severity
  // Format the time and render
  // Add the alert category

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

  // Save the alerts list to allow flash on new alerts
  filtered.forEach(a => seenAlertIds.add(a.AlertID));
  
  //console.log("Filtered alerts:", filtered);
}

// Query alerts from API
async function fetchAlerts() {
  try {
    const res = await safeFetch('/api/alerts');                                                                     // Use safeFetch wrapper to query API
    if (!res.ok) throw new Error(`Server responded with ${res.status}`);                                            // Check for any return errors
    const data = await res.json();                                                                                  // Store the return data
    renderAlerts(data.items);                                                                                       // Update the alerts table
    populateCustomerCheckboxes();                                                                                   // Check customer list - Will only re-render if something changed                                 

  } catch (err) {                                                                                                   // Print onscreen if there was an error
    console.error('Failed to fetch alerts', err);
    alertsDiv.innerHTML = `<div style="color: red;">Failed to load alerts. This may be due to a missing or invalid Atera API key on the server.</div>`;
  }
  // console.log("Fetching alerts...");
  // console.log("Selected customers:", getSelectedCustomerIds());

}

// Render the Customer checkbox list
async function populateCustomerCheckboxes(force = false) {
  try {
    const res = await safeFetch('/api/customers');                                                                  // Use safeFetch wrapper to query API
    if (!res.ok) throw new Error(`Server responded with ${res.status}`);                                            // Check for any return errors
    const data = await res.json();                                                                                  // Store the return data

    const namesOnly = data.items.map(c => c.CustomerName).join(',');                                                // Skip re-rendering if data is identical and not forced
    const current = allCustomers.map(c => c.CustomerName).join(',');
    if (!force && namesOnly === current) return;

    allCustomers = data.items.sort((a, b) => a.CustomerName.localeCompare(b.CustomerName));

    customerLogos = {};                                                                                             // Update customer logos
    allCustomers.forEach(c => {
      if (c.Logo) customerLogos[c.CustomerID] = c.Logo;                                                             // If the API returned a logo, use it
    });

    renderCustomerCheckboxes(document.getElementById('customerSearch').value);                                      // Link to html element

  } catch (err) {                                                                                                   // Print onscreen if there was an error
    console.error('Failed to fetch customer list:', err);
    document.getElementById('customerCheckboxes').innerHTML = `<div style="color: red;">Failed to load customer list. This may be due to a missing or invalid Atera API key on the server.</div>`;
  }
}

// === On Page Load ===
document.addEventListener('DOMContentLoaded', () => {
  refreshRate.addEventListener('change', () => {                                                                    // Register onscreen selector for change events
    clearInterval(refreshInterval);                                                                                 // Clear any existing timer
    refreshInterval = setInterval(fetchAlerts, Number(refreshRate.value));                                          // Set timer to selected rate
    startCountdown();                                                                                               // Start timer 
  });

  const savedToggle = localStorage.getItem('branchLookupsEnabled');                                                 // Retrieve Branch lookup toggle state from local storage
  branchLookupsEnabled = savedToggle === null ? false : savedToggle === 'true';                                     // Default to false if not in local storage
  document.getElementById('toggleBranchLookup').checked = branchLookupsEnabled;                                     // Update onscreen toggle
  document.getElementById('toggleBranchLookup').addEventListener('change', (e) => {                                 // Register onscreen toggle for change events
    branchLookupsEnabled = e.target.checked;                                                                        // Store onscreen toggle state
    localStorage.setItem('branchLookupsEnabled', branchLookupsEnabled);                                             // Save state to local storage
    renderCustomerCheckboxes(document.getElementById('customerSearch').value);                                      // Add branch text to customer list
  });

  document.getElementById('customerSearch').addEventListener('input', e => {                                        // Register onscreen customer search box for keypress events
    renderCustomerCheckboxes(e.target.value);                                                                       // Update customer checkbox list by search text
  });

  setupDarkModeToggle();                                                                                            // Dark mode onscreen toggle button

  populateCustomerCheckboxes();                                                                                     // Build customer checkbox list values
  fetchAlerts();                                                                                                    // Query API for current alerts
  refreshInterval = setInterval(fetchAlerts, Number(refreshRate.value));                                            // Run fetchAlerts on the selected timer
  startCountdown();                                                                                                 // Start the 'Refreshing In:' timer

});
