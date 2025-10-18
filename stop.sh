#!/data/data/com.termux/files/usr/bin/bash

echo "--- Stopping all project processes ---"

# Kill the python servers
pkill -f "logger.py"
pkill -f "dashboard.py"

# Kill the monitor loop (which is running inside start.sh)
pkill -f "start.sh"

sleep 1
echo "✅ All processes stopped."