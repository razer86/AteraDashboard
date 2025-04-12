# Atera Dashboard

A self-hosted web dashboard for viewing and filtering alerts and agent availability from the Atera API in real-time.

## 🚀 Features

- Display current alerts and agent statuses
- Filter by selected customers or search by name
- Inline customer logo and branch support (custom field)
- Smart refresh countdown and rate-limited background branch lookups
- Light/dark theme toggle with system preference detection
- Collapsible and responsive customer selection UI
- Uses `localStorage` to persist selections
- Built-in API error handling and adaptive request pacing

## 🔧 Setup

### 1. Clone the repository

```bash
git clone https://github.com/razer86/AteraDashboard.git
cd atera-dashboard
```

### 2. Add your Atera API key

Create a `.env` file in the root directory:

```
ATERA_API_KEY=your-api-key-here
```

Or copy the example:

```bash
cp .env.example .env
```

### 3. Install dependencies

```bash
npm install
```

### 4. Run the dashboard

```bash
npm start
```

Then open `http://localhost:3001` in your browser.

### Optional

You can also use the included launchers:

- **Windows:** `LaunchDashboard.bat`
- **Linux/macOS:** `launch-dashboard.sh`

These auto-install Node.js (if missing), install dependencies, and open your browser.

## 🧠 Custom Field: Branch

The dashboard uses the Atera API to look up the `Branch` custom field per customer and display it next to their name. This lookup is lazy and rate-limited to avoid exceeding API limits.

## 🌗 Dark Mode

A floating 🌙 / ☀️ toggle in the bottom-right corner allows you to switch themes. Theme preference is stored locally and also auto-detected from system settings.

## 📦 Tech Stack

- Node.js + Express (backend)
- Vanilla JS + HTML/CSS (frontend)
- Atera REST API v3
- No database required

## 🔐 Security Notes

This dashboard assumes you are hosting it in a secure, internal environment. The API key is stored server-side and not exposed to the frontend.

## 📄 License

MIT