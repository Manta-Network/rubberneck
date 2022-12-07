#!/usr/bin/env bash

# usage: curl -sL https://raw.githubusercontent.com/Manta-Network/rubberneck/main/daemon/sync-load-balancer.sh | bash

tmp=$(mktemp -d)

_decode_property() {
  echo ${1} | base64 --decode | jq -r ${2}
}
_valid_ip() {
  local ip=$1
  local stat=1
  if [[ $ip =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$ ]]; then
    OIFS=$IFS
    IFS='.'
    ip=($ip)
    IFS=$OIFS
    [[ ${ip[0]} -le 255 && ${ip[1]} -le 255 \
        && ${ip[2]} -le 255 && ${ip[3]} -le 255 ]]
    stat=$?
  fi
  return $stat
}

rubberneck_app=$(basename "${0}")
rubberneck_github_org=Manta-Network
rubberneck_github_repo=rubberneck
rubberneck_github_token=$(yq -r .github.token ${HOME}/.rubberneck.yml)
if [ -z "${rubberneck_github_token}" ] && which pass 2> /dev/null; then
  rubberneck_github_token=$(pass github/grenade/hub-workstation)
fi

cloudflare_api_token=$(yq -r .cloudflare.token ${HOME}/.rubberneck.yml)
if [ -z "${cloudflare_api_token}" ] && which pass 2> /dev/null; then
  cloudflare_api_token=$(pass cloudflare/sync-load-balancer)
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
  curl -sL \
    -o ${tmp}/${rubberneck_github_org}-${rubberneck_github_repo}-contents-config-${domain}.json \
    -H "Accept: application/vnd.github+json" \
    -H "Authorization: Bearer ${rubberneck_github_token}" \
    https://api.github.com/repos/${rubberneck_github_org}/${rubberneck_github_repo}/contents/config/${domain}
  host_list=( $(jq -r '.[] | select(.type == "dir") | .name' ${tmp}/${rubberneck_github_org}-${rubberneck_github_repo}-contents-config-${domain}.json) )
  echo "[sync] domain: ${domain}, instance count: ${#host_list[@]}"
  for hostname in ${host_list[@]}; do
    fqdn=${hostname}.${domain}
    tld=$(echo ${fqdn} | rev | cut -d "." -f1-2 | rev)
    unset alias_list_as_base64
    if curl -sL \
      -o ${tmp}/${fqdn}-config.yml \
      https://raw.githubusercontent.com/${rubberneck_github_org}/${rubberneck_github_repo}/${rubberneck_github_latest_sha}/config/${domain}/${hostname}/config.yml; then
      #echo "[${fqdn}] config fetch suceeded"
      action=$(yq -r .action ${tmp}/${fqdn}-config.yml)
      case ${tld} in
        seabird.systems|moonsea.systems)
          ip=$(getent hosts ${fqdn} | cut -d ' ' -f 1)
          if _valid_ip ${ip}; then
            alias_list_as_base64=($(yq -r '.dns.alias[] | @base64' ${tmp}/${fqdn}-config.yml 2>/dev/null))
            for alias_as_base64 in ${alias_list_as_base64[@]}; do
              alias_name=$(_decode_property ${alias_as_base64} .name)
              if host ${alias_name} 1.1.1.1 | grep 'has address' | grep ${ip}; then
                echo "[${fqdn}] detected existing dns record for ${alias_name} with ip: ${ip}"
                continue
              elif [ "${action}" = "sync" ]; then
                zone=$(curl -s \
                  -H "Content-Type: application/json" \
                  -H "Authorization: Bearer ${cloudflare_api_token}" \
                  "https://api.cloudflare.com/client/v4/zones?name=${tld}&status=active" \
                | jq -r '.result[0].id')
                if [ -z "${zone}" ]; then
                  echo "[${fqdn}] failed to determine cloudflare dns zone for ${alias_name}"
                  continue
                fi
                if curl -s \
                  -o ${tmp}/cloudflare-dns-record-create-response-${fqdn}-${alias_name}-${ip}.json \
                  -X POST \
                  -H "Content-Type: application/json" \
                  -H "Authorization: Bearer ${cloudflare_api_token}" \
                  --data "{\"type\":\"A\",\"name\":\"${alias_name}\",\"content\":\"${ip}\",\"ttl\":1,\"proxied\":false}" \
                  "https://api.cloudflare.com/client/v4/zones/${zone}/dns_records"; then
                  echo "[${fqdn}] alias: ${alias_name} A record created for ${ip} in zone: ${tld} (${zone}), record: $(jq -r '.result.id' ${tmp}/cloudflare-dns-record-create-response-${fqdn}-${alias_name}-${ip}.json)"
                else
                  jq -c . ${tmp}/cloudflare-dns-record-create-response-${fqdn}-${alias_name}-${ip}.json
                  echo "[${fqdn}] failed to create alias: ${alias_name} with ip: ${ip} in zone: ${tld} (${zone})"
                fi
              fi
            done
          else
            echo "[${fqdn}] alias checks skipped. failed to determine ip address"
          fi
          ;;
        kusama.systems)
          # todo: handle multi-node instances
          echo "[${fqdn}] alias checks skipped. multi-node instance"
          ;;
        *)
          health_resource_path=/health
          health_endpoint=https://${fqdn}${health_resource_path}
          health_response_code=$(curl --write-out '%{http_code}' --silent --output /dev/null ${health_endpoint})
          #echo "[${fqdn}] observed health response code (${health_endpoint}): ${health_response_code}"
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
              echo "[${fqdn}] health check creation skipped. health check response code: ${health_response_code}"
            fi
          #else
          #  echo "[${fqdn}] observed health check id: ${health_check_id}"
          fi
          if [ "${#health_check_id}" = "36" ]; then
            if [ "${health_response_code}" = "200" ]; then
              is_syncing=$(curl --silent ${health_endpoint} | jq -r .isSyncing)
            else
              is_syncing=possible
            fi
            observed_tcp_connection_count=$(curl -s https://${fqdn}/node/metrics | egrep 'node_netstat_Tcp_CurrEstab [[:digit:]]+' | cut -d ' ' -f 2)

            curl -s \
              -o ${tmp}/${fqdn}-etc-units-contents.json \
              -H "Accept: application/vnd.github+json" \
              -H "Authorization: Bearer ${rubberneck_github_token}" \
              https://api.github.com/repos/${rubberneck_github_org}/${rubberneck_github_repo}/contents/config/${domain}/${hostname}/etc/systemd/system
            curl -s \
              -o ${tmp}/${fqdn}-lib-units-contents.json \
              -H "Accept: application/vnd.github+json" \
              -H "Authorization: Bearer ${rubberneck_github_token}" \
              https://api.github.com/repos/${rubberneck_github_org}/${rubberneck_github_repo}/contents/config/${domain}/${hostname}/usr/lib/systemd/system

            declare -a units_urls=()
            for units_file in ${tmp}/${fqdn}-etc-units-contents.json ${tmp}/${fqdn}-lib-units-contents.json; do
              if [ "$(head -c 1 ${units_file})" = "[" ]; then
                units_urls+=( $(jq -r '.[] | select(.name | endswith(".service")) | .download_url' ${units_file}) )
              fi
            done
            for unit_url in ${units_urls[@]}; do
              configured_ws_max_connections=$(curl -s ${unit_url} | egrep -o 'ws-max-connections [[:digit:]]+ ' | head -n 1 | egrep -o '[[:digit:]]+')
              if [ -n "${configured_ws_max_connections}" ]; then
                #echo "[${fqdn}] observed ws-max-connections (${unit_url}): ${configured_ws_max_connections}"
                break
              fi
            done
            if [ -z "${configured_ws_max_connections}" ]; then
              configured_ws_max_connections=100
              #echo "[${fqdn}] default ws-max-connections: ${configured_ws_max_connections}"
            fi
            computed_resource_availability=$(echo "scale=3; 1 - ${observed_tcp_connection_count} / ${configured_ws_max_connections}" | bc -l | head -n 1)
            alias_list_as_base64=($(yq -r '.dns.alias[] | @base64' ${tmp}/${fqdn}-config.yml 2>/dev/null))
            for alias_as_base64 in ${alias_list_as_base64[@]}; do
              alias_name=$(_decode_property ${alias_as_base64} .name)
              configured_alias_weight=$(_decode_property ${alias_as_base64} .weight)
              if [ "${computed_resource_availability:0:1}" = "-" ]; then
                # resource availability is negative
                computed_alias_weight=0
              elif [ "${health_response_code}" = "200" ] && [ "${is_syncing}" = "false" ]; then
                # resource availability is positive, node is healthy and not syncing
                computed_alias_weight=$(echo "(${configured_alias_weight} * (1 - ${observed_tcp_connection_count} / ${configured_ws_max_connections}))" | bc -l | head -n 1)
                if [[ ${computed_alias_weight} == *"."* ]]; then
                  computed_alias_weight=${computed_alias_weight%%.*}
                fi
              else
                # node is unhealthy or syncing
                computed_alias_weight=0
              fi
              zone=$(basename $(aws route53 list-hosted-zones --profile pelagos-ops | jq --arg tld ${tld}. -r '.HostedZones[] | select(.Name == $tld) | .Id'))
              if [ -n "${zone}" ]; then
                observed_alias_weight=$(aws route53 list-resource-record-sets \
                  --profile pelagos-ops \
                  --hosted-zone-id ${zone} \
                  --output text \
                  --query "ResourceRecordSets[? AliasTarget.DNSName=='${fqdn}.' && Name=='${alias_name}.'].Weight")
                if [ "${action}" = "sync" ] && [ "${observed_alias_weight}" != "${computed_alias_weight}" ]; then
                  echo '
                    {
                      "Changes": [
                        {
                          "Action": "UPSERT",
                          "ResourceRecordSet": {
                            "Name": "",
                            "SetIdentifier": "",
                            "Weight": 0,
                            "Type": "A",
                            "AliasTarget": {
                              "HostedZoneId": "",
                              "DNSName": "",
                              "EvaluateTargetHealth": true
                            },
                            "HealthCheckId": ""
                          }
                        }
                      ]
                    }
                  ' | jq \
                      --arg name ${alias_name} \
                      --arg id ${hostname} \
                      --arg fqdn ${fqdn} \
                      --arg zone ${zone} \
                      --arg hci ${health_check_id} \
                      --arg weight ${computed_alias_weight} \
                      '
                        .
                        | .Changes[0].ResourceRecordSet.Name = $name
                        | .Changes[0].ResourceRecordSet.SetIdentifier = $id
                        | .Changes[0].ResourceRecordSet.AliasTarget.DNSName = $fqdn
                        | .Changes[0].ResourceRecordSet.AliasTarget.HostedZoneId = $zone
                        | .Changes[0].ResourceRecordSet.HealthCheckId = $hci
                        | .Changes[0].ResourceRecordSet.Weight = ($weight|tonumber)
                      ' > ${tmp}/change-resource-record-set-${fqdn}.json
                  if aws route53 change-resource-record-sets \
                    --profile pelagos-ops \
                    --hosted-zone-id ${zone} \
                    --change-batch=file://${tmp}/change-resource-record-set-${fqdn}.json > ${tmp}/change-resource-record-set-${fqdn}-result.json; then
                    jq -c . ${tmp}/change-resource-record-set-${fqdn}-result.json
                    updated_alias_weight=${computed_alias_weight}
                  else
                    unset updated_alias_weight
                  fi
                else
                  unset updated_alias_weight
                fi
              else
                unset observed_alias_weight
                unset updated_alias_weight
                echo "[${fqdn}] failed to determine zone for tld: ${tld}"
              fi
              echo "[${fqdn}] alias: ${alias_name}, computed resource availability: ${computed_resource_availability}, configured max connections: ${configured_ws_max_connections}, observed connections: ${observed_tcp_connection_count}, observed weight: ${observed_alias_weight}, configured weight: ${configured_alias_weight}, computed weight: ${computed_alias_weight}, updated weight: ${updated_alias_weight}, health check: ${health_check_id}, health response: ${health_response_code}, syncing: ${is_syncing}"
            done
          fi
          ;;
      esac
    else
      echo "[${fqdn}] config fetch failed"
    fi
  done
done
