#!/usr/bin/env bash

latest_manta_release_path=${HOME}/.local/bin/manta
blockchains_path=/tmp/5eklk8knsd-blockchains.json
blockchains_url=https://5eklk8knsd.execute-api.eu-central-1.amazonaws.com/prod/blockchains
authority_key_id="14:2E:B3:17:B7:58:56:CB:AE:50:09:40:E6:1F:AF:9D:8B:14:C2:C6"
mongo_connection=$(cat ${HOME}/.mongo-rubberneck-readwrite)
observer_ip=$(curl -sL https://checkip.amazonaws.com)
color_danger=ff0000
color_warn=ffbf00
color_success=aaff00
color_info=2ca6e0
webhook_dev=${HOME}/.discord/manta/devops/dev/marvin.webhook
webhook_test=${HOME}/.discord/manta/devops/test/marvin.webhook
webhook_prod=${HOME}/.discord/manta/devops/prod/marvin.webhook
webhook_debug=${HOME}/.discord/pelagos/marvin.webhook

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
    --username 'marvin the paranoid android' \
    --avatar https://gist.githubusercontent.com/grenade/f6ea0e897ee632e6fd318cf0fcba5b4f/raw/marvin.png \
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
function join_by {
  local d=${1-} f=${2-}
  if shift 2; then
    printf %s "$f" "${@/#/$d}"
  fi
}


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

if curl \
  -sLH 'Cache-Control: no-cache, no-store' \
  -o ${blockchains_path} \
  ${blockchains_url} \
  && [ -s ${blockchains_path} ]; then
  _echo_to_stderr "    fetched ${blockchains_path} from ${blockchains_url}"
else
  rm -f ${blockchains_path}
  _echo_to_stderr "    failed to fetch ${blockchains_path} from ${blockchains_url}"
  exit 1
fi

latest_manta_release_index_url=https://api.github.com/repos/Manta-Network/Manta/releases/latest
latest_manta_release_download_url=$(curl \
  -sL \
  -H 'Cache-Control: no-cache, no-store' \
  -H 'Accept: application/vnd.github+json' \
  ${latest_manta_release_index_url} \
  | jq -r '.assets[] | select(.name == "manta") | .browser_download_url')

if curl \
  -sLH 'Cache-Control: no-cache, no-store' \
  -o ${latest_manta_release_path} \
  ${latest_manta_release_download_url} \
  && [ -s ${latest_manta_release_path} ] \
  && chmod +x ${latest_manta_release_path}; then
  _echo_to_stderr "    fetched ${latest_manta_release_path} from ${latest_manta_release_download_url}"
else
  rm -f ${latest_manta_release_path}
  _echo_to_stderr "    failed to fetch ${latest_manta_release_path} from ${latest_manta_release_download_url}"
  exit 1
fi
latest_manta_release_version=$(${latest_manta_release_path} --version | head -n 1 | cut -d ' ' -f2)

blockchains_as_base64=( $(jq -r '.blockchains[] | @base64' ${blockchains_path}) )
_echo_to_stderr "    observed ${#blockchains_as_base64[@]} blockchain configurations in ${blockchains_path}"
for blockchain_as_base64 in ${blockchains_as_base64[@]}; do
  blockchain_name=$(_decode_property ${blockchain_as_base64} .name)
  blockchain_tier=$(_decode_property ${blockchain_as_base64} .tier)
  if [ ${blockchain_tier} = "parachain" ]; then
    relaychain_name=$(_decode_property ${blockchain_as_base64} .relay)
    nodes_url=https://5eklk8knsd.execute-api.eu-central-1.amazonaws.com/prod/nodes/${relaychain_name}/${blockchain_name}
    nodes_path=/tmp/5eklk8knsd-nodes-${relaychain_name}-${blockchain_name}.json
    blockchain_id=${relaychain_name}/${blockchain_name}
  else
    nodes_url=https://5eklk8knsd.execute-api.eu-central-1.amazonaws.com/prod/nodes/${blockchain_name}
    nodes_path=/tmp/5eklk8knsd-nodes-${blockchain_name}.json
    blockchain_id=${blockchain_name}
  fi
  echo "- ${blockchain_id}"

  if curl \
    -sLH 'Cache-Control: no-cache, no-store' \
    -o ${nodes_path} \
    ${nodes_url} \
    && [ -s ${nodes_path} ]; then
    _echo_to_stderr "  fetched ${nodes_path} from ${nodes_url}"
  else
    rm -f ${nodes_path}
    _echo_to_stderr "  failed to fetch ${nodes_path} from ${nodes_url}"
    continue
  fi
  nodes_as_base64=( $(jq -r '.nodes[] | @base64' ${nodes_path}) )
  _echo_to_stderr "  observed ${#nodes_as_base64[@]} node configurations in ${nodes_path}"
  for node_as_base64 in ${nodes_as_base64[@]}; do
    node_fqdn=$(_decode_property ${node_as_base64} .fqdn)
    node_domain=$(_decode_property ${node_as_base64} .domain)
    case ${node_domain} in
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
    echo "  - ${node_fqdn}"
    cert_path=/tmp/5eklk8knsd-cert-${node_fqdn}.json
    old_cert_path=/tmp/5eklk8knsd-old-cert-${node_fqdn}.json
    if [ -s ${cert_path} ]; then
      [ -f ${old_cert_path} ] && rm ${old_cert_path}
      mv ${cert_path} ${old_cert_path}
    fi
    if ${HOME}/.local/bin/certinfo -domain ${node_fqdn} > ${cert_path} && [ -s ${cert_path} ]; then
      _echo_to_stderr "    obtained ${cert_path} with certinfo"
    else
      rm -f ${cert_path}
      _echo_to_stderr "    failed to obtain ${cert_path} with certinfo"
      mongosh --eval "db.observation.insertOne( { fqdn: '${node_fqdn}', node: { chain: '${blockchain_id}' }, observer: { ip: '${observer_ip}' }, observed: new Date() } )" ${mongo_connection} &> /dev/null
      continue
    fi
    observed_not_before=$(jq -r .not_before ${cert_path})
    observed_not_after=$(jq -r .not_after ${cert_path})
    if [ $(date +%s) -ge $(date -d ${observed_not_before} +%s) ] && [ $(date +%s) -le $(date -d ${observed_not_after} +%s) ]; then
      _echo_to_stderr "    certificate validity verified (${observed_not_before} - ${observed_not_after})"
      if [ $(date +%s) -gt $(date -d "${observed_not_after} - 7 day" +%s) ]; then
        _post_to_discord ${webhook_path} ssl-certificate ${color_danger} ${node_fqdn} "imminent expiry for ssl cert detected on ${node_fqdn}\n- issued: ${observed_not_before}\n- expires: ${observed_not_after}"
      elif [ $(date +%s) -gt $(date -d "${observed_not_after} - 30 day" +%s) ]; then
        _post_to_discord ${webhook_path} ssl-certificate ${color_warn} ${node_fqdn} "approaching expiry for ssl cert detected on ${node_fqdn}\n- issued: ${observed_not_before}\n- expires: ${observed_not_after}"
      elif [ -s ${old_cert_path} ] && [ $(date +%s) -ge $(date -d $(jq -r .not_after ${old_cert_path}) +%s) ]; then
        _echo_to_stderr "    certificate validity recovery detected"
        _post_to_discord ${webhook_path} ssl-certificate ${color_success} ${node_fqdn} "ssl cert renewal detected on ${node_fqdn}\n- issued: ${observed_not_before}\n- expired: ${observed_not_after}"
        rm ${old_cert_path}
      fi
    else
      _echo_to_stderr "    certificate validity refuted (${observed_not_before} - ${observed_not_after})"
      mongosh --eval "db.observation.insertOne( { fqdn: '${node_fqdn}', node: { chain: '${blockchain_id}' }, cert: { issued: new Date('${observed_not_before}'), expiry: new Date('${observed_not_after}') }, observer: { ip: '${observer_ip}' }, observed: new Date() } )" ${mongo_connection} &> /dev/null
      _post_to_discord ${webhook_path} ssl-certificate ${color_danger} ${node_fqdn} "expired ssl cert detected on ${node_fqdn}\n- issued: ${observed_not_before}\n- expired: ${observed_not_after}"
      continue
    fi
    observed_authority_key_id=$(jq -r .authority_key_id ${cert_path})
    if [ ${authority_key_id} = ${observed_authority_key_id} ]; then
      _echo_to_stderr "    certificate authority verified (${observed_authority_key_id})"
    else
      _echo_to_stderr "    certificate authority refuted (${observed_authority_key_id})"
      _post_to_discord ${webhook_path} ssl-certificate ${color_danger} ${node_fqdn} "unrecognised authority for ssl cert detected on ${node_fqdn}\n- authority: ${observed_authority_key_id}"
      continue
    fi
    observed_cert_name=$(jq -r .subject.common_name ${cert_path})
    if [ ${node_fqdn} = ${observed_cert_name} ]; then
      _echo_to_stderr "    certificate name verified (${observed_cert_name})"
    else
      _echo_to_stderr "    certificate name refuted (${observed_cert_name})"
      _post_to_discord ${webhook_path} ssl-certificate ${color_warn} ${node_fqdn} "unexpected ssl cert name detected on ${node_fqdn}\n- cert name: ${observed_cert_name}"
    fi

    is_syncing=$(curl -sL https://${node_fqdn}/health | jq .isSyncing)
    if [ "${is_syncing}" = true ]; then
      _echo_to_stderr "    sync in progress (${node_fqdn})"
      _post_to_discord ${webhook_debug} websocket ${color_warn} ${node_fqdn} "node observed in syncing state (https://${node_fqdn}/health)"
      continue
    elif [ "${is_syncing}" = false ]; then
      _echo_to_stderr "    node health rpc endpoint is reachable (https://${node_fqdn}/health)"
      _post_to_discord ${webhook_debug} websocket ${color_info} ${node_fqdn} "node observed in not syncing state (https://${node_fqdn}/health)"
    else
      _echo_to_stderr "    node health rpc endpoint unreachable (https://${node_fqdn}/health)"
      _post_to_discord ${webhook_path} websocket ${color_danger} ${node_fqdn} "node health rpc endpoint unreachable (https://${node_fqdn}/health)"
      continue
    fi

    observed_peer_id=$(echo system_localPeerId | ${HOME}/.local/bin/websocat --jsonrpc wss://${node_fqdn} | jq -r .result)
    observed_peer_id_length=${#observed_peer_id}
    if (( observed_peer_id_length = 52 )) && [[ ${observed_peer_id} == 12* ]]; then
      _echo_to_stderr "    peer id verified (${observed_peer_id})"
    else
      _echo_to_stderr "    peer id refuted (${observed_peer_id})"
      _post_to_discord ${webhook_path} websocket ${color_danger} ${node_fqdn} "failed to obtain node id over websocket connection to ${node_fqdn}"
      mongosh --eval "db.observation.insertOne( { fqdn: '${node_fqdn}', node: { chain: '${blockchain_id}' }, cert: { issued: new Date('${observed_not_before}'), expiry: new Date('${observed_not_after}') }, observer: { ip: '${observer_ip}' }, observed: new Date() } )" ${mongo_connection} &> /dev/null
      continue
    fi
    observed_peer_count=$(echo system_health | ${HOME}/.local/bin/websocat --jsonrpc wss://${node_fqdn} | jq -r .result.peers)
    if (( observed_peer_count > 0 )); then
      _echo_to_stderr "    peer count verified (${observed_peer_count})"
    else
      _echo_to_stderr "    peer count refuted (${observed_peer_count})"
      _post_to_discord ${webhook_path} peers ${color_danger} ${node_fqdn} "no peers detected for ${node_fqdn}"
      continue
    fi
    observed_system_version=$(echo system_version | ${HOME}/.local/bin/websocat --jsonrpc wss://${node_fqdn} | jq -r .result)
    if [ -n ${observed_system_version} ]; then
      if [ -n "${latest_manta_release_version}" ] && [ ${node_domain} = "calamari.systems" ]; then
        if [ ${observed_system_version} = ${latest_manta_release_version} ]; then
          _echo_to_stderr "    system version (${observed_system_version}) matches latest manta version (${latest_manta_release_version})"
        else
          _echo_to_stderr "    system version (${observed_system_version}) does not match latest manta version (${latest_manta_release_version})"
          mongosh --eval "db.observation.insertOne( { fqdn: '${node_fqdn}', node: { id: '${observed_peer_id}', version: '${observed_system_version}', chain: '${blockchain_id}', peers: ${observed_peer_count} }, cert: { issued: new Date('${observed_not_before}'), expiry: new Date('${observed_not_after}') }, observer: { ip: '${observer_ip}' }, observed: new Date() } )" ${mongo_connection} &> /dev/null
          _post_to_discord ${webhook_path} semver ${color_warn} ${node_fqdn} "outdated manta version detected on ${node_fqdn}\n- latest release: [${latest_manta_release_version}](https://github.com/Manta-Network/Manta/releases/latest)\n- observed version: ${observed_system_version}"
          continue
        fi
      else
        _echo_to_stderr "    system version verified (${observed_system_version})"
      fi
    else
      _echo_to_stderr "    system version refuted (${observed_system_version})"
      continue
    fi

    pending_updates=( $(ssh -i ${ssh_key} -o ConnectTimeout=3 -o StrictHostKeyChecking=accept-new mobula@${node_fqdn} 'sudo unattended-upgrade --dry-run -d 2> /dev/null | grep Checking | cut -d " " -f2') )
    pending_update_count=${#pending_updates[@]}
    if (( pending_update_count > 0 )); then
      if (( pending_update_count > 30 )); then
        color_severity=${color_danger}
      elif (( pending_update_count > 20 )); then
        color_severity=${color_warn}
      else
        color_severity=${color_info}
      fi
      pending_updates_json=$(jq -nc '$ARGS.positional' --args ${pending_updates[@]})
      mongosh --eval "db.observation.insertOne( { fqdn: '${node_fqdn}', node: { id: '${observed_peer_id}', version: '${observed_system_version}', chain: '${blockchain_id}', peers: ${observed_peer_count} }, cert: { issued: new Date('${observed_not_before}'), expiry: new Date('${observed_not_after}') }, updates: { pending: ${pending_updates_json//\"/\'} }, observer: { ip: '${observer_ip}' }, observed: new Date() } )" ${mongo_connection} &> /dev/null
      _post_to_discord ${webhook_debug} package ${color_severity} ${node_fqdn} "${node_fqdn} requires ${pending_update_count} package updates\n- $(join_by '\n- ' ${pending_updates[@]})"
      continue
    fi
    mongosh --eval "db.observation.insertOne( { fqdn: '${node_fqdn}', node: { id: '${observed_peer_id}', version: '${observed_system_version}', chain: '${blockchain_id}', peers: ${observed_peer_count} }, cert: { issued: new Date('${observed_not_before}'), expiry: new Date('${observed_not_after}') }, observer: { ip: '${observer_ip}' }, observed: new Date() } )" ${mongo_connection} &> /dev/null
    _post_to_discord ${webhook_debug} check ${color_info} ${node_fqdn} "all validations passed for ${node_fqdn}\n- node id:\n  ${observed_peer_id}\n- peers: ${observed_peer_count}\n- version: ${observed_system_version}\n- cert validity: ${observed_not_before:0:10} - ${observed_not_after:0:10}"
  done
done
