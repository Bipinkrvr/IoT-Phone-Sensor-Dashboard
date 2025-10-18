#!/data/data/com.termux/files/usr/bin/bash

# --- Part 1: Run from Termux ---

PROJECT_DIR=$(dirname "$(realpath "$0")")
LOG_DIR=$PROJECT_DIR/logs
mkdir -p $LOG_DIR

echo "--- Stopping any old processes ---"
pkill -f "logger.py"
pkill -f "dashboard.py" # Kills any running dashboard
sleep 2 # Give ports time to close

echo "--- Starting Logger (port 5000) in Termux ---"
nohup python $PROJECT_DIR/scripts/logger.py > $LOG_DIR/logger.log 2>&1 &
echo "Logger started in background."
sleep 1 # Give it a second to start

# --- Part 2: Run inside Ubuntu ---

echo "--- Starting Dashboard (port 5050) in Ubuntu venv ---"
echo "This terminal will now run the dashboard. Leave it running."

# This is the string of commands to run *inside* Ubuntu
# 1. cd to your project
# 2. Activate the venv
# 3. Run the dashboard
UBUNTU_COMMANDS="cd /root/redmiedge && source venv/bin/activate && python app/dashboard.py"

# This command logs into Ubuntu and executes the command string
proot-distro login ubuntu -- bash -c "$UBUNTU_COMMANDS"

echo "--- Dashboard script has finished ---"