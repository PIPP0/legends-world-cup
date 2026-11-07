#!/bin/sh
# Publica Legends World Cup en GitHub Pages: https://pipp0.github.io/legends-world-cup/
set -e
cd "$(dirname "$0")"
git init -q -b main
git add -A
git commit -q -m "Legends World Cup v0.1"
gh repo create PIPP0/legends-world-cup --public --source=. --push
gh api -X POST repos/PIPP0/legends-world-cup/pages -f build_type=workflow
echo "Listo. En 1-2 minutos: https://pipp0.github.io/legends-world-cup/"
