#!/usr/bin/env bash

curl \
  -sLH 'Cache-Control: no-cache, no-store' \
  https://raw.githubusercontent.com/Manta-Network/rubberneck/main/daemon/rubberneck.sh?$(uuidgen) | bash
