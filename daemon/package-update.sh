#!/usr/bin/env bash

# usage: curl -sL https://raw.githubusercontent.com/Manta-Network/rubberneck/main/daemon/package-update.sh | bash

if dpkg -l manta; then
  sudo apt update && sudo DEBIAN_FRONTEND=noninteractive apt upgrade -y && [ -f /var/run/reboot-required ] && sudo reboot
else
  for unit in calamari-pc manta-pc dolphin baikal como calamari calamari-testnet manta manta-testnet; do
    if [ -d /var/log/${unit} ] && systemctl is-active --quiet ${unit}.service; then
      sudo apt update && sudo DEBIAN_FRONTEND=noninteractive apt upgrade -y
      [ -f /var/run/reboot-required ] && sudo systemctl stop ${unit}.service && [ -f /var/log/${unit}/stderr.log ] && sudo mv /var/log/${unit}/stderr.log /var/log/${unit}/stderr-$(date --utc --iso-8601=seconds).log && sudo reboot
    fi
  done
fi
