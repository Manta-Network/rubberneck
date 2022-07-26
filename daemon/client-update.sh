#!/usr/bin/env bash

# usage: curl -sL https://raw.githubusercontent.com/Manta-Network/rubberneck/main/daemon/client-update.sh | bash

if dpkg -l manta; then
  if systemctl is-active --quiet calamari.service; then
    calamari_service_pre_update_state=active
  else
    calamari_service_pre_update_state=inactive
  fi
  if systemctl is-active --quiet dolphin.service; then
    dolphin_service_pre_update_state=active
  else
    dolphin_service_pre_update_state=inactive
  fi
  if systemctl is-active --quiet manta.service; then
    manta_service_pre_update_state=active
  else
    manta_service_pre_update_state=inactive
  fi

  export DEBIAN_FRONTEND=noninteractive
  sudo apt autoremove -y
  sudo apt update
  sudo apt install -y --only-upgrade manta

  sudo curl -sLo /usr/share/substrate/rococo.json https://raw.githubusercontent.com/paritytech/polkadot/master/node/service/chain-specs/rococo.json
  sudo curl -sLo /usr/share/substrate/kusama.json https://raw.githubusercontent.com/paritytech/polkadot/master/node/service/chain-specs/kusama.json
  sudo curl -sLo /usr/share/substrate/polkadot.json https://raw.githubusercontent.com/paritytech/polkadot/master/node/service/chain-specs/polkadot.json

  if [ ${calamari_service_pre_update_state} = active ] && ! systemctl is-active --quiet calamari.service; then
    sudo systemctl start calamari.service && sleep 60
  fi
  if [ ${dolphin_service_pre_update_state} = active ] && ! systemctl is-active --quiet dolphin.service; then
    sudo systemctl start dolphin.service && sleep 60
  fi
  if [ ${manta_service_pre_update_state} = active ] && ! systemctl is-active --quiet manta.service; then
    sudo systemctl start manta.service && sleep 60
  fi
else
  for unit in calamari-pc manta-pc manta; do
    if systemctl is-active --quiet ${unit}.service; then
      if sudo systemctl stop ${unit}.service; then
        if [ -f /var/log/${unit}/stderr.log ]; then
          sudo mv /var/log/${unit}/stderr.log /var/log/${unit}/stderr-$(date --utc --iso-8601=seconds).log
        fi
        latest_manta_release_index_url=https://api.github.com/repos/Manta-Network/Manta/releases/latest
        latest_manta_release_download_url=$(curl \
          -sL \
          -H 'Cache-Control: no-cache, no-store' \
          -H 'Accept: application/vnd.github+json' \
          ${latest_manta_release_index_url} \
          | jq -r '.assets[] | select(.name == "manta") | .browser_download_url')
        if sudo curl \
          -sLo /usr/local/bin/manta \
          ${latest_manta_release_download_url} \
          && sudo chmod +x /usr/local/bin/manta; then
          if [ ${unit} != manta ]; then
            sudo rm -f /usr/local/bin/${unit}
            sudo ln -sfr /usr/local/bin/manta /usr/local/bin/${unit}
          fi
        fi
        sudo systemctl start ${unit}.service && sleep 60
      fi
    fi
  done
fi
