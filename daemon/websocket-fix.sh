#!/usr/bin/env bash

# usage: curl -sL https://raw.githubusercontent.com/Manta-Network/rubberneck/main/daemon/websocket-fix.sh | bash

case $(hostname -d) in
  calamari.systems)
    if dpkg -l manta; then
      unit=calamari
    else
      unit=calamari-pc
    fi
    ;;
  rococo.dolphin.engineering)
    unit=dolphin
    ;;
  manta.systems)
    unit=manta
    ;;
  *)
    unset unit
    ;;
esac

if [ -n ${unit} ]; then
  if systemctl is-enabled ${unit}.service; then
    echo "detected enabled state for ${unit}.service"
  else
    if sudo systemctl enable ${unit}.service; then
      echo "set enabled state for ${unit}.service"
    else
      echo "failed to set enabled state for ${unit}.service"
      exit 1
    fi
  fi
  if systemctl is-active ${unit}.service; then
    echo "detected active state for ${unit}.service"
  else
    if sudo systemctl start ${unit}.service; then
      echo "set active state for ${unit}.service"
    else
      echo "failed to set active state for ${unit}.service"
      exit 1
    fi
  fi
fi
