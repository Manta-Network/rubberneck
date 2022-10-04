#!/usr/bin/env bash

# usage: curl -sL https://raw.githubusercontent.com/Manta-Network/rubberneck/main/daemon/sync-shared-certs.sh | bash

tmp=$(mktemp -d)
#subl ${tmp}

_decode_property() {
  echo ${1} | base64 --decode | jq -r ${2}
}

rubberneck_app=$(basename "${0}")
rubberneck_github_org=Manta-Network
rubberneck_github_repo=rubberneck
rubberneck_github_token=$(yq -r .github.token ${HOME}/.rubberneck.yml)
if [ -z "${rubberneck_github_token}" ] && which pass 2> /dev/null; then
  rubberneck_github_token=$(pass github/grenade/hub-workstation)
fi
curl -sL \
  -o ${tmp}/${rubberneck_github_org}-${rubberneck_github_repo}-commits.json \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer ${rubberneck_github_token}" \
  https://api.github.com/repos/${rubberneck_github_org}/${rubberneck_github_repo}/commits
rubberneck_github_latest_sha=$(jq -r .[0].sha ${tmp}/${rubberneck_github_org}-${rubberneck_github_repo}-commits.json)
rubberneck_github_latest_date=$(jq -r .[0].commit.committer.date ${tmp}/${rubberneck_github_org}-${rubberneck_github_repo}-commits.json)

ops_private_key=${HOME}/.ssh/id_manta_ci

curl -sL \
  -o ${tmp}/${rubberneck_github_org}-${rubberneck_github_repo}-contents-config.json \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer ${rubberneck_github_token}" \
  https://api.github.com/repos/${rubberneck_github_org}/${rubberneck_github_repo}/contents/config

echo "[init] repo: ${rubberneck_github_org}/${rubberneck_github_repo}"
echo "[init] commit: ${rubberneck_github_latest_sha} ${rubberneck_github_latest_date}"

curl -sL \
  -o ${tmp}/${rubberneck_github_org}-${rubberneck_github_repo}-contents-config.json \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer ${rubberneck_github_token}" \
  https://api.github.com/repos/${rubberneck_github_org}/${rubberneck_github_repo}/contents/config

domain_list=$(jq -r '.[] | select(.type == "dir") | .name' ${tmp}/${rubberneck_github_org}-${rubberneck_github_repo}-contents-config.json)
for domain in ${domain_list[@]}; do
  curl -sL \
    -o ${tmp}/${rubberneck_github_org}-${rubberneck_github_repo}-contents-config-${domain}.json \
    -H "Accept: application/vnd.github+json" \
    -H "Authorization: Bearer ${rubberneck_github_token}" \
    https://api.github.com/repos/${rubberneck_github_org}/${rubberneck_github_repo}/contents/config/${domain}
  host_list=$(jq -r '.[] | select(.type == "dir") | .name' ${tmp}/${rubberneck_github_org}-${rubberneck_github_repo}-contents-config-${domain}.json)
  for hostname in ${host_list[@]}; do
    if curl -sL \
      -o ${tmp}/${hostname}.${domain}-config.yml \
      https://raw.githubusercontent.com/${rubberneck_github_org}/${rubberneck_github_repo}/${rubberneck_github_latest_sha}/config/${domain}/${hostname}/config.yml; then
      echo "[${hostname}.${domain}] config fetch suceeded"
      action=$(yq -r .action ${tmp}/${hostname}.${domain}-config.yml)
      alias_list_as_base64=$(yq -r '.dns.alias[] | @base64' ${tmp}/${hostname}.${domain}-config.yml)
      for alias_as_base64 in ${alias_list_as_base64[@]}; do
        alias_name=$(_decode_property ${alias_as_base64} .name)
        for cert_target in archive live; do
          if [ "${action}" = "sync" ]; then
            if [ "$(hostname -s)" = "kavula" ] && [ -d /etc/letsencrypt/${cert_target}/${alias_name} ]; then
              if rsync -e "ssh -o ConnectTimeout=1 -o StrictHostKeyChecking=accept-new -i ${ops_private_key}" -og --chown=root:root --rsync-path='sudo rsync' -a /etc/letsencrypt/${cert_target}/${alias_name}/ ${ops_username}@${fqdn}:/etc/letsencrypt/${cert_target}/${alias_name}; then
                echo "[${hostname}.${domain}:/etc/letsencrypt/${cert_target}/${alias_name}] sync suceeded"
              else
                echo "[${hostname}.${domain}:/etc/letsencrypt/${cert_target}/${alias_name}] sync failed"
              fi
            else
              echo "[${hostname}.${domain}:/etc/letsencrypt/${cert_target}/${alias_name}] sync not attempted due to missing cert"
              if [ "$(hostname -s)" = "kavula" ]; then
                test -f /etc/letsencrypt/renewal/${alias_name}.conf || certbot certonly -m ops@manta.network --agree-tos --no-eff-email --dns-route53 -d ${alias_name}
              fi
            fi
          else
            echo "[${hostname}.${domain}:/etc/letsencrypt/${cert_target}/${alias_name}] sync skipped"
          fi
        done
      done
    else
      echo "[${hostname}.${domain}] config fetch failed"
    fi
  done
done
