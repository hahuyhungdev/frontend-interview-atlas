#!/bin/bash
set -e

# Change directory to script's directory
cd "$(dirname "$0")"

echo "=== Initializing Crawler Virtual Environment ==="

# Create venv if not exists
if [ ! -d ".venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv .venv
fi

# Activate venv
echo "Activating virtual environment..."
source .venv/bin/activate

# Install dependencies
echo "Installing/upgrading dependencies (beautifulsoup4)..."
pip install --quiet --upgrade pip
pip install --quiet beautifulsoup4

# Run crawler
echo "=== Running Crawler ==="
python3 crawler.py "$@"

echo "=== Scraping & Synthesis Complete ==="
