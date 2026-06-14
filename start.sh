#!/bin/bash

echo "======================================================"
echo "🚀 Booting Sential AI Local Engine..."
echo "======================================================"
echo ""
echo "Pulling containers and building local dependencies..."

# Run docker-compose
docker-compose up --build -d

echo ""
echo "🌐 Waiting for Sential Cortex to initialize..."
sleep 8

echo "Opening Sential in your default browser..."

# OS-specific browser open commands
if which xdg-open > /dev/null
then
  xdg-open http://localhost:5173
elif which open > /dev/null
then
  open http://localhost:5173
else
  echo "Navigate to http://localhost:5173 in your browser."
fi

echo ""
echo "======================================================"
echo "✅ SYSTEM LIVE. You can close this terminal."
echo "To stop the engine, run: docker-compose down"
echo "======================================================"