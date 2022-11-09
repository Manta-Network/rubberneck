#!/usr/bin/env bash

# usage: curl -sL https://raw.githubusercontent.com/Manta-Network/rubberneck/main/daemon/install-sync-load-balancer.sh | bash

unit=sync-load-balancer.service
unit_path=/etc/systemd/system
unit_url=https://raw.githubusercontent.com/Manta-Network/rubberneck/main/daemon/${unit}

if [ -s ${unit_path}/${unit} ]; then
  systemctl is-active ${unit} && sudo systemctl stop ${unit}
  sudo curl -Lo ${unit_path}/${unit} ${unit_url}
  sudo systemctl daemon-reload
  systemctl is-enabled ${unit} || sudo systemctl enable ${unit}
  sudo systemctl start ${unit}
else
  sudo curl -Lo ${unit_path}/${unit} ${unit_url}
  sudo systemctl enable --now ${unit}
fi
