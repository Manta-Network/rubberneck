#!/bin/bash

# usage: curl -sL https://raw.githubusercontent.com/Manta-Network/rubberneck/main/daemon/checksum-correction.sh | bash

_decode_property() {
  echo ${1} | base64 --decode | jq -r ${2}
}

executables_as_base64=( $(curl -sL https://raw.githubusercontent.com/Manta-Network/rubberneck/main/config/executable-version.json | jq --arg fqdn $(hostname -f) -r '.[] | select (.fqdn == $fqdn) | @base64') )
for executable_as_base64 in ${executables_as_base64[@]}; do
  expected_path=$(_decode_property ${executable_as_base64} .path)
  expected_sha256=$(_decode_property ${executable_as_base64} .sha256)
  expected_unit=$(_decode_property ${executable_as_base64} .unit)
  expected_url=$(_decode_property ${executable_as_base64} .url)

  observed_sha256=$(sha256sum ${expected_path} | cut -d ' ' -f 1)
  if [ "${observed_sha256}" = "${expected_sha256}" ]; then
    echo "$(hostname -f):${expected_path} checksum (${observed_sha256}) matches expected checksum (${expected_sha256})"
  else
    echo "$(hostname -f):${expected_path} checksum (${observed_sha256}) does not match expected checksum (${expected_sha256})"
    systemctl is-active --quiet ${expected_unit} && sudo systemctl stop ${expected_unit}
    sudo curl -sLo ${expected_path} ${expected_url}
    sudo chmod +x ${expected_path}
    sudo systemctl start ${expected_unit}
  fi
done
