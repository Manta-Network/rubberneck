#!/usr/bin/env bash

# usage: curl -sL https://raw.githubusercontent.com/Manta-Network/rubberneck/main/daemon/sync-load-balancer.sh | bash

tmp=$(mktemp -d)

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

ops_username=mobula
ops_private_key=${HOME}/.ssh/id_manta_ci

curl -sL \
  -o ${tmp}/${rubberneck_github_org}-${rubberneck_github_repo}-contents-config.json \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer ${rubberneck_github_token}" \
  https://api.github.com/repos/${rubberneck_github_org}/${rubberneck_github_repo}/contents/config

echo "[init] repo: ${rubberneck_github_org}/${rubberneck_github_repo}"
echo "[init] commit: ${rubberneck_github_latest_sha} ${rubberneck_github_latest_date}"

if [ -z "${chain_list}" ]; then
  domain_list=( $(jq -r '.[] | select(.type == "dir") | .name' ${tmp}/${rubberneck_github_org}-${rubberneck_github_repo}-contents-config.json) )
else
  curl -sL \
    -o ${tmp}/blockchains.json \
    https://5eklk8knsd.execute-api.eu-central-1.amazonaws.com/prod/blockchains
  domain_list=()
  for chain in ${chain_list[@]}; do
    if [[ ${chain} == *"/"* ]]; then
      chain_domain_list=$(jq --arg name ${chain##*/} --arg relay ${chain%%/*} -r '.blockchains[] | select(.name == $name and .relay == $relay) | .domains[]' ${tmp}/blockchains.json)
    else
      chain_domain_list=$(jq --arg name ${chain} -r '.blockchains[] | select(.name == $name) | .domains[]' ${tmp}/blockchains.json)
    fi
    domain_list+=( "${chain_domain_list[@]}" )
  done
fi

for domain in ${domain_list[@]}; do
  echo "[sync] domain: ${domain}"
  curl -sL \
    -o ${tmp}/${rubberneck_github_org}-${rubberneck_github_repo}-contents-config-${domain}.json \
    -H "Accept: application/vnd.github+json" \
    -H "Authorization: Bearer ${rubberneck_github_token}" \
    https://api.github.com/repos/${rubberneck_github_org}/${rubberneck_github_repo}/contents/config/${domain}
  host_list=$(jq -r '.[] | select(.type == "dir") | .name' ${tmp}/${rubberneck_github_org}-${rubberneck_github_repo}-contents-config-${domain}.json)
  for hostname in ${host_list[@]}; do
    fqdn=${hostname}.${domain}
    if curl -sL \
      -o ${tmp}/${fqdn}-config.yml \
      https://raw.githubusercontent.com/${rubberneck_github_org}/${rubberneck_github_repo}/${rubberneck_github_latest_sha}/config/${domain}/${hostname}/config.yml; then
      echo "[${fqdn}] config fetch suceeded"
      action=$(yq -r .action ${tmp}/${fqdn}-config.yml)
      
      # todo: handle multi-node instances
      if [ "${domain}" != "internal.kusama.systems" ]; then
        health_resource_path=/health
        health_endpoint=https://${fqdn}${health_resource_path}
        health_response_code=$(curl --write-out '%{http_code}' --silent --output /dev/null ${health_endpoint})
        echo "[${fqdn}] observed health response code (${health_endpoint}): ${health_response_code}"
        health_check_id=$(aws route53 list-health-checks --profile pelagos-ops --output text --query "HealthChecks[?HealthCheckConfig.FullyQualifiedDomainName=='${fqdn}'].Id")
        if [ -z "${health_check_id}" ]; then
          if [ "${health_response_code}" = "200" ]; then
            echo '{
                "Port": 443,
                "Type": "HTTPS",
                "RequestInterval": 30,
                "FailureThreshold": 3,
                "MeasureLatency": true,
                "EnableSNI": true
              }' | jq \
                --arg fqdn ${fqdn} \
                --arg health_resource_path ${health_resource_path} \
                '
                  .
                  | .FullyQualifiedDomainName = $fqdn
                  | .ResourcePath = $health_resource_path
                ' > ${tmp}/create-health-check-${fqdn}.json
            if aws route53 create-health-check \
              --profile pelagos-ops \
              --caller-reference ${fqdn} \
              --health-check-config file://${tmp}/create-health-check-${fqdn}.json; then
              health_check_id=$(aws route53 list-health-checks --profile pelagos-ops --output text --query "HealthChecks[?HealthCheckConfig.FullyQualifiedDomainName=='${fqdn}'].Id")
              echo "[${fqdn}] created health check id: ${health_check_id}"
            else
              echo "[${fqdn}] health check creation failed"
            fi
          else
            echo "[${fqdn}] health check creation skipped"
          fi
        else
          echo "[${fqdn}] observed health check id: ${health_check_id}"
        fi
      fi
    else
      echo "[${fqdn}] config fetch failed"
    fi
  done
done
