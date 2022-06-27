#!/usr/bin/env bash

authority_key_id="14:2E:B3:17:B7:58:56:CB:AE:50:09:40:E6:1F:AF:9D:8B:14:C2:C6"
mongo_connection=$(cat ${HOME}/.mongo-rubberneck-readwrite)
color_danger=ff0000
color_warn=ffbf00
color_success=aaff00
webhook_dev=${HOME}/.discord/manta/devops/dev/mustache.webhook

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
    --webhook-url $(cat ${HOME}/.discord.mustache) \
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

if [ ! -x ${HOME}/.local/bin/certinfo ]; then
  [ -d ${HOME}/.local/bin ] || mkdir -p ${HOME}/.local/bin
  curl -sLo ${HOME}/.local/bin/certinfo https://github.com/cloudflare/cfssl/releases/download/v1.6.1/cfssl-certinfo_1.6.1_linux_amd64
  chmod +x ${HOME}/.local/bin/certinfo
fi

if [ ! -x ${HOME}/.local/bin/discord.sh ]; then
  [ -d ${HOME}/.local/bin ] || mkdir -p ${HOME}/.local/bin
  curl -sLo ${HOME}/.local/bin/discord.sh https://raw.githubusercontent.com/ChaoticWeg/discord.sh/054bf62/discord.sh
  chmod +x ${HOME}/.local/bin/discord.sh
fi

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

for node_fqdn in ${cert_renewal_targets[@]}; do
  node_tld=$(echo ${fqdn} | rev | cut -d "." -f1-2 | rev)
  echo "- fqdn: ${node_fqdn}, tld: ${node_tld}"
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
      #if ssh -i ${ssh_key} -o ConnectTimeout=3 -o StrictHostKeyChecking=accept-new mobula@${node_fqdn} 'sudo systemctl stop nginx.service && sudo certbot renew && sudo systemctl start nginx.service'; then
      if ssh -i ${ssh_key} -o ConnectTimeout=3 -o StrictHostKeyChecking=accept-new mobula@${node_fqdn} 'curl -sL https://raw.githubusercontent.com/Manta-Network/rubberneck/main/daemon/cert-fix.sh | bash'; then
        renewed_not_before=$(${HOME}/.local/bin/certinfo -domain ${node_fqdn} | jq -r .not_before)
        renewed_not_after=$(${HOME}/.local/bin/certinfo -domain ${node_fqdn} | jq -r .not_after)
        if [ $(date -d 'next month' +%s) -lt $(date -d "${renewed_not_after}" +%s) ]; then
          _post_to_discord ${webhook_dev} ssl-certificate ${color_success} ${node_fqdn} "ssl cert renewed for ${node_fqdn}\n- issued: ${renewed_not_before}\n- expiry: ${renewed_not_after}"
        else
          _post_to_discord ${webhook_dev} ssl-certificate ${color_danger} ${node_fqdn} "ssl cert renewal failed for ${node_fqdn}\n- issued: ${renewed_not_before}\n- expiry: ${renewed_not_after}"
        fi
      fi
    else
      _echo_to_stderr "  certificate validity verified (${observed_not_before} - ${observed_not_after})"
      #_post_to_discord ${webhook_dev} ssl-certificate ${color_warn} ${node_fqdn} "approaching expiry for ssl cert detected on ${node_fqdn}\n- issued: ${observed_not_before}\n- expires: ${observed_not_after}"
    fi
  else
    _echo_to_stderr "  certificate validity refuted (${observed_not_before} - ${observed_not_after})"
    #mongosh --eval "db.observation.insertOne( { fqdn: '${node_fqdn}', node: { chain: '${blockchain_id}' }, cert: { issued: new Date('${observed_not_before}'), expiry: new Date('${observed_not_after}') }, observer: { ip: '${observer_ip}' }, observed: new Date() } )" ${mongo_connection} &> /dev/null
    #_post_to_discord ${webhook_dev} ssl-certificate ${color_danger} ${node_fqdn} "expired ssl cert detected on ${node_fqdn}\n- issued: ${observed_not_before}\n- expired: ${observed_not_after}"
    continue
  fi
  #mongosh --eval "db.observation.insertOne( { fqdn: '${node_fqdn}', node: { chain: '${blockchain_id}' }, observer: { ip: '${observer_ip}' }, observed: new Date() } )" ${mongo_connection} &> /dev/null
done
