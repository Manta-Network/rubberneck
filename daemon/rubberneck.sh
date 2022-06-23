#!/usr/bin/env bash

blockchains_path=/tmp/5eklk8knsd-blockchains.json
blockchains_url=https://5eklk8knsd.execute-api.eu-central-1.amazonaws.com/prod/blockchains
authority_key_id="14:2E:B3:17:B7:58:56:CB:AE:50:09:40:E6:1F:AF:9D:8B:14:C2:C6"


_decode_property() {
  echo ${1} | base64 --decode | jq -r ${2}
}
_echo_to_stderr() {
  echo "$@" 1>&2;
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

blockchains_as_base64=( $(jq -r '.blockchains[] | @base64' ${blockchains_path}) )
_echo_to_stderr "    observed ${#blockchains_as_base64[@]} blockchain configurations in ${blockchains_path}"
for blockchain_as_base64 in ${blockchains_as_base64[@]}; do
  blockchain_name=$(_decode_property ${blockchain_as_base64} .name)
  blockchain_tier=$(_decode_property ${blockchain_as_base64} .tier)
  if [ ${blockchain_tier} = "parachain" ]; then
    relaychain_name=$(_decode_property ${blockchain_as_base64} .relay)
    nodes_url=https://5eklk8knsd.execute-api.eu-central-1.amazonaws.com/prod/nodes/${relaychain_name}/${blockchain_name}
    nodes_path=/tmp/5eklk8knsd-nodes-${relaychain_name}-${blockchain_name}.json
    echo "- ${relaychain_name}/${blockchain_name}"
  else
    nodes_url=https://5eklk8knsd.execute-api.eu-central-1.amazonaws.com/prod/nodes/${blockchain_name}
    nodes_path=/tmp/5eklk8knsd-nodes-${blockchain_name}.json
    echo "- ${blockchain_name}"
  fi
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
      continue
    fi
    observed_not_before=$(jq -r .not_before ${cert_path})
    observed_not_after=$(jq -r .not_after ${cert_path})
    if [ $(date +%s) -ge $(date -d ${observed_not_before} +%s) ] && [ $(date +%s) -le $(date -d ${observed_not_after} +%s) ]; then
      _echo_to_stderr "    certificate validity verified (${observed_not_before} - ${observed_not_after})"
      if [ -s ${old_cert_path} ] && [ $(date +%s) -ge $(date -d $(jq -r .not_after ${old_cert_path}) +%s) ]; then
        _echo_to_stderr "    certificate validity recovery detected"
        ${HOME}/.local/bin/discord.sh \
          --color 0xaaff00 \
          --title "${node_fqdn}" \
          --description "ssl cert renewal detected on ${node_fqdn}\n- issued: ${observed_not_before}\n- expired: ${observed_not_after}" \
          --thumbnail https://www.globalsign.com/application/files/7115/7562/0340/chrome-expired-ssl.PNG \
          --author rubberneck \
          --author-url https://github.com/Manta-Network/rubberneck \
          --author-icon https://gawkstopper.com/wp-content/uploads/2019/05/rubbernecking-1.jpg \
          --url https://polkadot.js.org/apps/?rpc=wss%253A%252F%252F${node_fqdn} \
          --timestamp
        rm ${old_cert_path}
      fi
    else
      _echo_to_stderr "    certificate validity refuted (${observed_not_before} - ${observed_not_after})"
      ${HOME}/.local/bin/discord.sh \
        --color 0xff0000 \
        --title "${node_fqdn}" \
        --description "expired ssl cert detected on ${node_fqdn}\n- issued: ${observed_not_before}\n- expired: ${observed_not_after}" \
        --thumbnail https://www.globalsign.com/application/files/7115/7562/0340/chrome-expired-ssl.PNG \
        --author rubberneck \
        --author-url https://github.com/Manta-Network/rubberneck \
        --author-icon https://gawkstopper.com/wp-content/uploads/2019/05/rubbernecking-1.jpg \
        --url https://polkadot.js.org/apps/?rpc=wss%253A%252F%252F${node_fqdn} \
        --timestamp
        #--footer "discord.sh"
        #--description "ssl cert validity expiration detected" \
        #--color "0xffffff" \
        #--url "https://${node_fqdn}" \
        #--author "$(whoami)@$(hostname -f)" \
        #--author-url "https://github.com/Manta-Network/rubberneck" \
        #--author-icon "https://i.imgur.com/12jyR5Q.png" \
        #--image "https://i.imgur.com/12jyR5Q.png" \
        #--thumbnail "https://i.imgur.com/12jyR5Q.png" \
        #--field "Author;ChaoticWeg" \
        #--field "Author;fieu" \
        #--footer "discord.sh" \
        #--footer-icon "https://i.imgur.com/12jyR5Q.png" \
        #--timestamp
      continue
    fi
    observed_authority_key_id=$(jq -r .authority_key_id ${cert_path})
    if [ ${authority_key_id} = ${observed_authority_key_id} ]; then
      _echo_to_stderr "    certificate authority verified (${observed_authority_key_id})"
    else
      _echo_to_stderr "    certificate authority refuted (${observed_authority_key_id})"
      continue
    fi
    observed_cert_name=$(jq -r .subject.common_name ${cert_path})
    if [ ${node_fqdn} = ${observed_cert_name} ]; then
      _echo_to_stderr "    certificate name verified (${observed_cert_name})"
    else
      _echo_to_stderr "    certificate name refuted (${observed_cert_name})"
      ${HOME}/.local/bin/discord.sh \
        --color 0xffbf00 \
        --title "${node_fqdn}" \
        --description "unexpected ssl cert name detected on ${node_fqdn}\n- cert name: ${observed_cert_name}" \
        --author rubberneck \
        --author-url "https://github.com/Manta-Network/rubberneck" \
        --author-icon "https://gawkstopper.com/wp-content/uploads/2019/05/rubbernecking-1.jpg"
    fi

    observed_peer_count=$(echo system_health | ${HOME}/.local/bin/websocat --jsonrpc wss://${node_fqdn} | jq -r .result.peers)
    if (( observed_peer_count > 0 )); then
      _echo_to_stderr "    peer count verified (${observed_peer_count})"
    else
      _echo_to_stderr "    peer count refuted (${observed_peer_count})"
      continue
    fi
    observed_peer_id=$(echo system_localPeerId | ${HOME}/.local/bin/websocat --jsonrpc wss://${node_fqdn} | jq -r .result)
    observed_peer_id_length=${#observed_peer_id}
    if (( observed_peer_id_length = 52 )) && [[ ${observed_peer_id} == 12* ]]; then
      _echo_to_stderr "    peer id verified (${observed_peer_id})"
    else
      _echo_to_stderr "    peer id refuted (${observed_peer_id})"
      continue
    fi
    observed_system_version=$(echo system_version | ${HOME}/.local/bin/websocat --jsonrpc wss://${node_fqdn} | jq -r .result)
    if [ -n ${observed_system_version} ]; then
      _echo_to_stderr "    system version verified (${observed_system_version})"
    else
      _echo_to_stderr "    system version refuted (${observed_system_version})"
      continue
    fi
  done
done
