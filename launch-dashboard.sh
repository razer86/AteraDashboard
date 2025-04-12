#!/bin/bash

echo "============================"
echo " Atera Dashboard Launcher"
echo "============================"

cd "$(dirname "$0")"

# Check for Node.js
if ! command -v node >/dev/null 2>&1; then
  echo "[!] Node.js is not installed."

  # Try installing via Homebrew (macOS) if available
  if command -v brew >/dev/null 2>&1; then
    echo "[+] Installing Node.js via Homebrew..."
    brew install node
  else
    echo "[!] Please install Node.js manually:"
    echo "    https://nodejs.org/"
    open "https://nodejs.org/" 2>/dev/null || xdg-open "https://nodejs.org/"
    exit 1
  fi
fi

# Check for npm
if ! command -v npm >/dev/null 2>&1; then
  echo "[!] npm is not available. Check your Node.js installation."
  exit 1
fi

# Create package.json if missing
if [ ! -f package.json ]; then
  echo "[!] package.json not found. Creating a basic one..."
  cat <<EOF > package.json
{
  "name": "atera-dashboard",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "dotenv": "^16.0.0",
    "express": "^4.18.2",
    "node-fetch": "^2.6.7"
  }
}
EOF
fi

# Install dependencies if node_modules is missing
if [ ! -d node_modules ]; then
  echo "[+] Installing dependencies..."
  npm install
else
  echo "[+] Dependencies already installed."
fi

# Launch dashboard
echo "[+] Launching dashboard on http://localhost:3001 ..."
xdg-open "http://localhost:3001" 2>/dev/null || open "http://localhost:3001"
npm start
