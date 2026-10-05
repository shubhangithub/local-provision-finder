#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
if ! command -v node >/dev/null 2>&1; then
  dwp_runtime="$PWD/.tools/node"
  if [ ! -x "$dwp_runtime/bin/node" ]; then
    case "$(uname -s)" in Darwin) dwp_platform=darwin ;; Linux) dwp_platform=linux ;; *) echo 'Install Node.js 22 or newer, then run npm ci and npm run dev.' >&2; exit 1 ;; esac
    case "$(uname -m)" in arm64|aarch64) dwp_arch=arm64 ;; x86_64) dwp_arch=x64 ;; *) echo 'Unsupported architecture; install Node.js manually.' >&2; exit 1 ;; esac
    dwp_version=v22.23.3
    dwp_archive="node-$dwp_version-$dwp_platform-$dwp_arch.tar.gz"
    dwp_temp="$(mktemp -d)"
    trap 'rm -rf "$dwp_temp"' EXIT HUP INT TERM
    echo 'Installing a project-local Node.js runtime from nodejs.org…'
    curl -fsSL "https://nodejs.org/dist/$dwp_version/$dwp_archive" -o "$dwp_temp/$dwp_archive"
    curl -fsSL "https://nodejs.org/dist/$dwp_version/SHASUMS256.txt" -o "$dwp_temp/SHASUMS256.txt"
    dwp_expected="$(awk -v name="$dwp_archive" '$2 == name { print $1 }' "$dwp_temp/SHASUMS256.txt")"
    dwp_actual="$(shasum -a 256 "$dwp_temp/$dwp_archive" | awk '{print $1}')"
    [ -n "$dwp_expected" ] && [ "$dwp_expected" = "$dwp_actual" ] || { echo 'Node.js checksum verification failed.' >&2; exit 1; }
    mkdir -p "$dwp_runtime"
    tar -xzf "$dwp_temp/$dwp_archive" --strip-components=1 -C "$dwp_runtime"
    rm -rf "$dwp_temp"
    trap - EXIT HUP INT TERM
  fi
  PATH="$dwp_runtime/bin:$PATH"
  export PATH
fi
if [ ! -d node_modules ]; then npm ci; fi
exec npm run dev
