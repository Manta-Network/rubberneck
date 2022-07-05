#!/usr/bin/env bash

# usage: curl -sL https://raw.githubusercontent.com/Manta-Network/rubberneck/main/daemon/package-update.sh | bash

sudo apt update && sudo DEBIAN_FRONTEND=noninteractive apt upgrade -y && [ -f /var/run/reboot-required ] && sudo reboot
