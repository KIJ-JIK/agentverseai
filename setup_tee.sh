#!/usr/bin/env bash
# ==============================================================================
# DevFlow AI — TEE Setup & Enclave Signing Helper
# ==============================================================================
# Script to automate Intel SGX enclave key generation, manifest compilation,
# and signing for the DevFlow AI agentic pipeline running inside Gramine.
#
# Usage:
#   chmod +x setup_tee.sh
#   ./setup_tee.sh [mode]
#
# Arguments:
#   mode: Optional. "hw" for Intel SGX Hardware Mode (default) or "sim" for Simulation Mode.
# ==============================================================================

set -euo pipefail

# Parse mode (default to hardware mode)
MODE="${1:-hw}"
echo "======================================================================"
echo "DevFlow AI — TEE Setup & Enclave Signing"
echo "======================================================================"
echo "Target Mode: $(echo "$MODE" | tr '[:lower:]' '[:upper:]')"

# ── 1. Check for Gramine tools ────────────────────────────────────────────────
echo -n "Checking for Gramine tools... "
if ! command -v gramine-manifest &> /dev/null; then
    echo "FAILED"
    echo "Error: 'gramine-manifest' utility not found. Please install the Gramine toolchain."
    echo "See Gramine setup guide: https://gramine.readthedocs.io/"
    exit 1
fi
if ! command -v gramine-sgx-sign &> /dev/null; then
    echo "FAILED"
    echo "Error: 'gramine-sgx-sign' utility not found."
    exit 1
fi
echo "OK"

# ── 2. Generate Developer Enclave Key if not present ──────────────────────────
KEY_FILE="enclave-key.pem"
if [ ! -f "$KEY_FILE" ]; then
    echo "Generating developer enclave private key ($KEY_FILE)..."
    gramine-sgx-gen-private-key "$KEY_FILE"
else
    echo "Enclave key '$KEY_FILE' already exists. Reusing existing key."
fi

# ── 3. Detect System Library Paths ─────────────────────────────────────────────
echo "Detecting system configurations..."
PYTHON_PATH=$(which python3 || echo "/usr/bin/python3")
echo "  - Python Entrypoint: $PYTHON_PATH"

# Detect architectural library folder (Debian/Ubuntu standard vs RedHat/others)
if [ -d "/lib/x86_64-linux-gnu" ]; then
    ARCH_LIBDIR="/lib/x86_64-linux-gnu"
elif [ -d "/lib64" ]; then
    ARCH_LIBDIR="/lib64"
else
    ARCH_LIBDIR="/lib"
fi
echo "  - Arch Library Directory: $ARCH_LIBDIR"

# ── 4. Compile Manifest Template ──────────────────────────────────────────────
echo "Compiling Gramine manifest template (app.manifest.template)..."
gramine-manifest \
    -Dlog_level=error \
    -Darch_libdir="$ARCH_LIBDIR" \
    -Dentrypoint="$PYTHON_PATH" \
    app.manifest.template app.manifest

echo "Compiled app.manifest successfully."

# ── 5. Sign Enclave Manifest ──────────────────────────────────────────────────
echo "Signing enclave manifest..."
if [ "$MODE" = "sim" ]; then
    echo "Building in Simulation Mode (No SGX hardware attestation required)..."
    # For simulation mode, we just build the manifest. Enclave measurements are dummy.
    # Gramine supports running the app without sign structures, but signing generates metadata.
fi

gramine-sgx-sign \
    --key "$KEY_FILE" \
    --manifest app.manifest \
    --output app.manifest.sgx

echo "Signed app.manifest.sgx successfully."

# ── 6. Extract Cryptographic Measurement (MRENCLAVE & MRSIGNER) ───────────────
echo "Extracting enclave sigstruct details..."
SIGSTRUCT_FILE="enclave_sigstruct.txt"
gramine-sgx-sigstruct-view app.manifest.sgx > "$SIGSTRUCT_FILE"

echo "======================================================================"
echo "SGX Cryptographic Measurements (Saved to $SIGSTRUCT_FILE):"
echo "======================================================================"
grep -E "Attributes|mr_enclave|mr_signer" "$SIGSTRUCT_FILE" || true
echo "======================================================================"
echo "TEE enclave compilation and signing complete! Ready to execute."
echo "  - Run locally: gramine-sgx api_gateway.py"
echo "======================================================================"
