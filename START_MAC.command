#!/bin/bash
cd "$(dirname "$0")"
echo "Starting CDU Onex Dashboard..."

if ! command -v node &> /dev/null
then
    echo "ERROR: Node.js is not installed. Please install Node.js from https://nodejs.org/"
    exit
fi

if [ ! -d "node_modules" ]; then
    echo "Installing dependencies (this may take a few minutes)..."
    npm install
    echo "Installing Browser..."
    npx playwright install chromium
fi

echo "Launching Dashboard at http://localhost:3001..."
open http://localhost:3001
npm run dev -- -p 3001
