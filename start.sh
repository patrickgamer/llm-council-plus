#!/bin/bash

# LLM Council Plus - Start script

set -e

echo "================================"
echo "  LLM Council Plus Setup"
echo "================================"
echo ""

# --- Dependency Checks ---

# Function to ensure Homebrew is installed (macOS only)
ensure_homebrew() {
    if ! command -v brew &> /dev/null; then
        echo "Installing Homebrew..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

        # Add brew to PATH for Apple Silicon
        if [[ -f "/opt/homebrew/bin/brew" ]]; then
            eval "$(/opt/homebrew/bin/brew shellenv)"
        fi
        echo "✓ Homebrew installed"
    fi
}

# Check for uv
if ! command -v uv &> /dev/null; then
    echo "Installing uv..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        ensure_homebrew
        brew install uv
    else
        curl -LsSf https://astral.sh/uv/install.sh | sh
        export PATH="$HOME/.local/bin:$PATH"
    fi
    echo "✓ uv installed"
else
    echo "✓ uv found"
fi

# Check for Node.js and npm
if ! command -v node &> /dev/null || ! command -v npm &> /dev/null; then
    echo "Installing Node.js..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        ensure_homebrew
        brew install node
    else
        echo "Error: Node.js not found. Please install Node.js manually."
        exit 1
    fi
    echo "✓ Node.js installed"
else
    echo "✓ Node.js found ($(node --version))"
fi

echo ""
echo "--- Installing Dependencies ---"
echo ""

# Install Python dependencies
echo "Running uv sync..."
uv sync
echo "✓ Python dependencies installed"

# Install frontend dependencies
echo "Running npm install..."
cd frontend
npm install
cd ..
echo "✓ Frontend dependencies installed"

echo ""
echo "================================"
echo "  Starting LLM Council Plus"
echo "================================"
echo ""

# Start backend
echo "Starting backend on http://localhost:8001..."
uv run python -m backend.main &
BACKEND_PID=$!

# Wait a bit for backend to start
sleep 2

# Start frontend
echo "Starting frontend on http://localhost:5173..."
cd frontend
npm run dev -- --host &
FRONTEND_PID=$!

echo ""
echo "✓ LLM Council is running!"
echo "  Backend:  http://localhost:8001"
echo "  Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop both servers"

# Wait for Ctrl+C
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" SIGINT SIGTERM
wait
