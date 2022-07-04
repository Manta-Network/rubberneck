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

  sudo apt install --only-upgrade manta

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
fi
