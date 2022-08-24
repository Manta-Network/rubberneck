#!/usr/bin/env bash

authority_key_id="14:2E:B3:17:B7:58:56:CB:AE:50:09:40:E6:1F:AF:9D:8B:14:C2:C6"
mongo_connection=$(cat ${HOME}/.mongo-rubberneck-readwrite)
color_danger=ff0000
color_warn=ffbf00
color_success=aaff00
color_info=2ca6e0
webhook_dev=${HOME}/.discord/manta/devops/dev/mustache.webhook
webhook_test=${HOME}/.discord/manta/devops/test/mustache.webhook
webhook_prod=${HOME}/.discord/manta/devops/prod/mustache.webhook
webhook_debug=${HOME}/.discord/pelagos/mustache.webhook

ssh_key=${HOME}/.ssh/id_manta_ci
eval `ssh-agent`
ssh-add ${ssh_key}

_decode_property() {
  echo ${1} | base64 --decode | jq -r ${2}
}
_echo_to_stderr() {
  echo "$@" 1>&2;
}
_post_to_discord() {
  webhook=${1}
  image=${2}
  color=${3}
  fqdn=${4}
  message=${5}
  ${HOME}/.local/bin/discord.sh \
    --webhook-url $(cat ${webhook}) \
    --username 'mustache the fixer' \
    --avatar https://gist.githubusercontent.com/grenade/f6ea0e897ee632e6fd318cf0fcba5b4f/raw/mustache-the-fixer.png \
    --color 0x${color} \
    --title ${fqdn} \
    --description "${message}" \
    --thumbnail https://gist.githubusercontent.com/grenade/f6ea0e897ee632e6fd318cf0fcba5b4f/raw/${image}-${color}.png \
    --author rubberneck \
    --author-url https://github.com/Manta-Network/rubberneck \
    --author-icon https://gist.githubusercontent.com/grenade/f6ea0e897ee632e6fd318cf0fcba5b4f/raw/rush-to-the-people.png \
    --url https://polkadot.js.org/apps/?rpc=wss%253A%252F%252F${fqdn} \
    --timestamp
}

for webhook_path in ${webhook_dev} ${webhook_test} ${webhook_prod} ${webhook_debug}; do
  if [ ! -f ${webhook_path} ]; then
    _echo_to_stderr "  missing webhook credentials at ${webhook_path}"
    exit 1
  fi
done

if [ ! -x ${HOME}/.local/bin/certinfo ]; then
  [ -d ${HOME}/.local/bin ] || mkdir -p ${HOME}/.local/bin
  curl -sLo ${HOME}/.local/bin/certinfo https://github.com/cloudflare/cfssl/releases/download/v1.6.1/cfssl-certinfo_1.6.1_linux_amd64
  chmod +x ${HOME}/.local/bin/certinfo
fi

if [ ! -x ${HOME}/.local/bin/websocat ]; then
  [ -d ${HOME}/.local/bin ] || mkdir -p ${HOME}/.local/bin
  curl -sLo ${HOME}/.local/bin/websocat https://github.com/vi/websocat/releases/download/v1.10.0/websocat.x86_64-unknown-linux-musl
  chmod +x ${HOME}/.local/bin/websocat
fi

if [ ! -x ${HOME}/.local/bin/discord.sh ]; then
  [ -d ${HOME}/.local/bin ] || mkdir -p ${HOME}/.local/bin
  curl -sLo ${HOME}/.local/bin/discord.sh https://raw.githubusercontent.com/ChaoticWeg/discord.sh/054bf62/discord.sh
  chmod +x ${HOME}/.local/bin/discord.sh
fi

# tls certificate renewals
cert_renewal_targets=( $(mongosh --quiet --eval '
  JSON.stringify(
    db.observation.distinct(
      "fqdn",
      {
        observed: {
          $gt: new Date (ISODate().getTime() - 1000 * 60 * 20)
        },
        "cert.expiry": {
          $lt: new Date (ISODate().getTime() + 1000 * 60 * 60 * 24 * 30)
        }
      }
    )
  )
' ${mongo_connection} | jq -r '.[]') )
echo "- observed ${#cert_renewal_targets[@]} cert renewal targets"
for node_fqdn in ${cert_renewal_targets[@]}; do
  node_tld=$(echo ${node_fqdn} | rev | cut -d "." -f1-2 | rev)
  case ${node_fqdn#*.} in
    calamari.systems)
      webhook_path=${webhook_prod}
      ;;
    rococo.dolphin.engineering)
      webhook_path=${webhook_test}
      ;;
    *)
      webhook_path=${webhook_dev}
      ;;
  esac
  echo "  - fqdn: ${node_fqdn}, domain: ${node_fqdn#*.}, tld: ${node_tld}"
  cert_path=/tmp/$(uuidgen)-cert-${node_fqdn}.json
  if ${HOME}/.local/bin/certinfo -domain ${node_fqdn} > ${cert_path} && [ -s ${cert_path} ]; then
    _echo_to_stderr "  obtained ${cert_path} with certinfo"
  else
    rm -f ${cert_path}
    _echo_to_stderr "  failed to obtain ${cert_path} with certinfo"
    continue
  fi
  observed_not_before=$(jq -r .not_before ${cert_path})
  observed_not_after=$(jq -r .not_after ${cert_path})
  if [ $(date +%s) -ge $(date -d ${observed_not_before} +%s) ] && [ $(date +%s) -le $(date -d ${observed_not_after} +%s) ]; then
    if [ $(date +%s) -gt $(date -d "${observed_not_after} - 30 day" +%s) ]; then
      _echo_to_stderr "  approaching expiry for ssl cert detected (${observed_not_before} - ${observed_not_after})"
      if ssh -i ${ssh_key} -o ConnectTimeout=3 -o StrictHostKeyChecking=accept-new mobula@${node_fqdn} 'curl -sL https://raw.githubusercontent.com/Manta-Network/rubberneck/main/daemon/cert-fix.sh | bash'; then
        renewed_not_before=$(${HOME}/.local/bin/certinfo -domain ${node_fqdn} | jq -r .not_before)
        renewed_not_after=$(${HOME}/.local/bin/certinfo -domain ${node_fqdn} | jq -r .not_after)
        if [ $(date -d 'next month' +%s) -lt $(date -d "${renewed_not_after}" +%s) ]; then
          _post_to_discord ${webhook_path} ssl-certificate ${color_success} ${node_fqdn} "ssl cert renewed for ${node_fqdn}\n- issued: ${renewed_not_before}\n- expiry: ${renewed_not_after}"
        else
          _post_to_discord ${webhook_path} ssl-certificate ${color_danger} ${node_fqdn} "ssl cert renewal failed for ${node_fqdn}\n- issued: ${renewed_not_before}\n- expiry: ${renewed_not_after}"
        fi
      fi
    else
      _echo_to_stderr "  certificate validity verified (${observed_not_before} - ${observed_not_after})"
      #_post_to_discord ${webhook_path} ssl-certificate ${color_warn} ${node_fqdn} "approaching expiry for ssl cert detected on ${node_fqdn}\n- issued: ${observed_not_before}\n- expires: ${observed_not_after}"
    fi
  else
    _echo_to_stderr "  certificate validity refuted (${observed_not_before} - ${observed_not_after})"
    #mongosh --eval "db.observation.insertOne( { fqdn: '${node_fqdn}', node: { chain: '${blockchain_id}' }, cert: { issued: new Date('${observed_not_before}'), expiry: new Date('${observed_not_after}') }, observer: { ip: '${observer_ip}' }, observed: new Date() } )" ${mongo_connection} &> /dev/null
    #_post_to_discord ${webhook_path} ssl-certificate ${color_danger} ${node_fqdn} "expired ssl cert detected on ${node_fqdn}\n- issued: ${observed_not_before}\n- expired: ${observed_not_after}"
    continue
  fi
  #mongosh --eval "db.observation.insertOne( { fqdn: '${node_fqdn}', node: { chain: '${blockchain_id}' }, observer: { ip: '${observer_ip}' }, observed: new Date() } )" ${mongo_connection} &> /dev/null
done

# checksum corrections
checksum_correction_targets=( $(mongosh --quiet --eval '
  JSON.stringify(
    db.observation.distinct(
      "fqdn",
      {
        observed: {
          $gt: new Date (ISODate().getTime() - 1000 * 60 * 20)
        },
        "node.checksum": {
          $exists: true
        }
      }
    )
  )
' ${mongo_connection} | jq -r '.[]') )
echo "- observed ${#checksum_correction_targets[@]} checksum correction targets"
for node_fqdn in ${checksum_correction_targets[@]}; do
  node_tld=$(echo ${node_fqdn} | rev | cut -d "." -f1-2 | rev)
  echo "  - fqdn: ${node_fqdn}, domain: ${node_fqdn#*.}, tld: ${node_tld}"
  if ssh -i ${ssh_key} -o ConnectTimeout=3 -o StrictHostKeyChecking=accept-new mobula@${node_fqdn} 'curl -sL https://raw.githubusercontent.com/Manta-Network/rubberneck/main/daemon/checksum-correction.sh | bash'; then
    executables_as_base64=( $(curl -sL https://raw.githubusercontent.com/Manta-Network/rubberneck/main/config/executable-version.json | jq --arg fqdn ${node_fqdn} -r '.[] | select (.fqdn == $fqdn) | @base64') )
    _echo_to_stderr "    observed ${#executables_as_base64[@]} executable version configurations in https://raw.githubusercontent.com/Manta-Network/rubberneck/main/config/executable-version.json"
    for executable_as_base64 in ${executables_as_base64[@]}; do
      expected_path=$(_decode_property ${executable_as_base64} .path)
      expected_sha256=$(_decode_property ${executable_as_base64} .sha256)
      expected_unit=$(_decode_property ${executable_as_base64} .unit)
      expected_url=$(_decode_property ${executable_as_base64} .url)

      observed_sha256=$(ssh -i ${ssh_key} -o ConnectTimeout=3 -o StrictHostKeyChecking=accept-new mobula@${node_fqdn} "sha256sum ${path} | cut -d ' ' -f 1")
      if [ "${observed_sha256}" = "${expected_sha256}" ]; then
        _echo_to_stderr "    ${expected_path} checksum (${observed_sha256}) matches expected checksum (${expected_sha256})"
        _post_to_discord ${webhook_path} semver ${color_success} ${node_fqdn} "observed valid checksum for ${expected_path} on ${node_fqdn}\n- expected: [${expected_sha256}](${expected_url})\n- observed: ${observed_sha256}"
      else
        _echo_to_stderr "    ${expected_path} checksum (${observed_sha256}) does not match expected checksum (${expected_sha256})"
        _post_to_discord ${webhook_debug} semver ${color_warn} ${node_fqdn} "observed invalid checksum for ${expected_path} on ${node_fqdn}\n- expected: [${expected_sha256}](${expected_url})\n- observed: ${observed_sha256}"
      fi
    done
  fi
done

# websockets
websocket_offline_targets=( $(mongosh --quiet --eval '
  JSON.stringify(
    db.observation.distinct(
      "fqdn",
      {
        observed: {
          $gt: new Date (ISODate().getTime() - 1000 * 60 * 20)
        },
        "node.id": {
          $exists: false
        },
        "syncing.para": {
          $ne: true
        },
        "syncing.relay": {
          $ne: true
        }
      }
    )
  )
' ${mongo_connection} | jq -r '.[]') )
echo "- observed ${#websocket_offline_targets[@]} websocket offline targets"
for node_fqdn in ${websocket_offline_targets[@]}; do
  node_tld=$(echo ${node_fqdn} | rev | cut -d "." -f1-2 | rev)
  case ${node_fqdn#*.} in
    calamari.systems)
      webhook_path=${webhook_prod}
      ;;
    rococo.dolphin.engineering)
      webhook_path=${webhook_test}
      ;;
    *)
      webhook_path=${webhook_dev}
      ;;
  esac
  echo "  - fqdn: ${node_fqdn}, domain: ${node_fqdn#*.}, tld: ${node_tld}"
  observed_peer_id=$(echo system_localPeerId | ${HOME}/.local/bin/websocat --jsonrpc wss://${node_fqdn} | jq -r .result)
  observed_peer_id_length=${#observed_peer_id}
  if (( observed_peer_id_length = 52 )) && [[ ${observed_peer_id} == 12* ]]; then
    _echo_to_stderr "    peer id verified (${observed_peer_id})"
    _post_to_discord ${webhook_path} websocket ${color_success} ${node_fqdn} "node id (${observed_peer_id}) obtained over websocket connection to ${node_fqdn}"
  else
    _echo_to_stderr "    peer id refuted (${observed_peer_id})"
    if ssh -i ${ssh_key} -o ConnectTimeout=3 -o StrictHostKeyChecking=accept-new mobula@${node_fqdn} 'curl -sL https://raw.githubusercontent.com/Manta-Network/rubberneck/main/daemon/websocket-fix.sh | bash'; then
      observed_peer_id=$(echo system_localPeerId | ${HOME}/.local/bin/websocat --jsonrpc wss://${node_fqdn} | jq -r .result)
      observed_peer_id_length=${#observed_peer_id}
      if (( observed_peer_id_length = 52 )) && [[ ${observed_peer_id} == 12* ]]; then
        _echo_to_stderr "    peer id verified (${observed_peer_id})"
        _post_to_discord ${webhook_path} websocket ${color_success} ${node_fqdn} "node id (${observed_peer_id}) obtained over websocket connection to ${node_fqdn}"
      else
        _post_to_discord ${webhook_debug} websocket ${color_danger} ${node_fqdn} "failed to obtain node id over websocket after running websocket-fix on ${node_fqdn}"
      fi
    fi
  fi
done

# package updates
package_update_targets=( $(mongosh --quiet --eval '
  JSON.stringify(
    db.observation.distinct(
      "fqdn",
      {
        observed: {
          $gt: new Date (ISODate().getTime() - 1000 * 60 * 20)
        },
        "updates.pending": {
          $exists: true
        },
        "updates.pending.0": {
          $exists: true
        }
      }
    )
  )
' ${mongo_connection} | jq -r '.[]') )
echo "- observed ${#package_update_targets[@]} package update targets"
for node_fqdn in ${package_update_targets[@]}; do
  node_tld=$(echo ${node_fqdn} | rev | cut -d "." -f1-2 | rev)
  case ${node_fqdn#*.} in
    calamari.systems)
      webhook_path=${webhook_prod}
      ;;
    rococo.dolphin.engineering)
      webhook_path=${webhook_test}
      ;;
    *)
      webhook_path=${webhook_dev}
      ;;
  esac
  echo "  - fqdn: ${node_fqdn}, domain: ${node_fqdn#*.}, tld: ${node_tld}"
  pending_update_count_pre_patch=$(ssh -i ${ssh_key} -o ConnectTimeout=3 -o StrictHostKeyChecking=accept-new mobula@${node_fqdn} 'sudo unattended-upgrade --dry-run -d 2> /dev/null | grep Checking | cut -d " " -f2 | wc -l')
  if (( pending_update_count_pre_patch > 0 )); then
    _echo_to_stderr "    ${pending_update_count_pre_patch} pending updates detected"

    # trigger updates. also reboots, if required. usually returns a non zero exit code, due to disconnect triggered by reboot
    ssh -i ${ssh_key} -o ConnectTimeout=3 -o StrictHostKeyChecking=accept-new mobula@${node_fqdn} 'curl -sL https://raw.githubusercontent.com/Manta-Network/rubberneck/main/daemon/package-update.sh | bash'

    # check update success
    sleep 20
    if ssh -i ${ssh_key} -o ConnectTimeout=60 -o StrictHostKeyChecking=accept-new mobula@${node_fqdn} exit; then
      pending_update_count_post_patch=$(ssh -i ${ssh_key} -o ConnectTimeout=3 -o StrictHostKeyChecking=accept-new mobula@${node_fqdn} 'sudo unattended-upgrade --dry-run -d 2> /dev/null | grep Checking | cut -d " " -f2 | wc -l')
      package_update_count=$(( pending_update_count_pre_patch - pending_update_count_post_patch ))
      if (( pending_update_count_post_patch < 1 )); then
        _post_to_discord ${webhook_debug} package ${color_success} ${node_fqdn} "${package_update_count}/${pending_update_count_pre_patch} packages updated on ${node_fqdn}"
      elif (( package_update_count > 0 )); then
        _post_to_discord ${webhook_debug} package ${color_info} ${node_fqdn} "${package_update_count}/${pending_update_count_pre_patch} packages updated on ${node_fqdn}"
      else
        _post_to_discord ${webhook_debug} package ${color_danger} ${node_fqdn} "${package_update_count}/${pending_update_count_pre_patch} packages updated on ${node_fqdn}"
      fi
    else
      _post_to_discord ${webhook_debug} package ${color_danger} ${node_fqdn} "failed to determine if package updates succeeded on ${node_fqdn}"
    fi
  else
    _echo_to_stderr "    no pending updates detected"
  fi
done
