#!/bin/bash
# Start AgentGuard monitoring with prompt filtering for OpenClaw

set -e

AGENTGUARD_DIR="$HOME/projects/agentguard"
CONFIG_FILE="$HOME/.openclaw/agentguard-config.yaml"

echo "🛡️  Starting AgentGuard with OpenClaw integration..."

# Check if AgentGuard is installed
if [ ! -d "$AGENTGUARD_DIR" ]; then
    echo "❌ AgentGuard not found at $AGENTGUARD_DIR"
    echo "Clone from: https://github.com/mumetnaroq-sudo/agentguard/tree/v2-rewrite"
    exit 1
fi

# Check if config exists
if [ ! -f "$CONFIG_FILE" ]; then
    echo "⚠️  Config not found at $CONFIG_FILE"
    echo "Using default config..."
    CONFIG_FILE="$AGENTGUARD_DIR/config.example.yaml"
fi

cd "$AGENTGUARD_DIR"

# Initialize database if needed
if [ ! -f "agentguard.db" ]; then
    echo "📦 Initializing AgentGuard database..."
    python3 -c "from database.schema import init_db; init_db()"
fi

# Run pre-flight tests
echo "🧪 Running pre-flight checks..."
python3 tests/test_prompt_filter.py --quick

echo ""
echo "✅ AgentGuard ready!"
echo ""
echo "Starting monitoring with:"
echo "  - Code threat scanning (15 signatures)"
echo "  - Prompt injection filtering (26 signatures)"
echo "  - GLOSSOPETRAE detection (λ constructs, void markers)"
echo "  - Behavior monitoring"
echo "  - Integrity checking"
echo ""
echo "Press Ctrl+C to stop"
echo ""

# Start the engine
exec python3 engine.py --config "$CONFIG_FILE"
