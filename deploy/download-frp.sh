#!/usr/bin/env bash
set -euo pipefail
cd /root/frp-download
base="https://ghfast.top/https://github.com/fatedier/frp/releases/download/v0.72.0"
for f in frp_0.72.0_linux_amd64.tar.gz frp_0.72.0_windows_amd64.zip frp_0.72.0_darwin_arm64.tar.gz frp_0.72.0_darwin_amd64.tar.gz frp_sha256_checksums.txt; do
  if [ ! -s "$f" ]; then
    echo "downloading $f"
    curl -fL --max-time 300 -o "$f" "$base/$f"
  fi
done
sha256sum -c <(grep -E 'frp_0.72.0_(linux_amd64|windows_amd64|darwin_arm64|darwin_amd64)\.(tar\.gz|zip)' frp_sha256_checksums.txt)
ls -lh
