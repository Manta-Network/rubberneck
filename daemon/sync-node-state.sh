#!/usr/bin/env bash

# usage: curl -sL https://raw.githubusercontent.com/Manta-Network/rubberneck/main/daemon/sync-node-state.sh | bash

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
    fqdn=${hostname}.${domain}
    if curl -sL \
      -o ${tmp}/${fqdn}-config.yml \
      https://raw.githubusercontent.com/${rubberneck_github_org}/${rubberneck_github_repo}/${rubberneck_github_latest_sha}/config/${domain}/${hostname}/config.yml; then
      echo "[${fqdn}] config fetch suceeded"
      action=$(yq -r .action ${tmp}/${fqdn}-config.yml)

      command_list_as_base64=$(yq -r '(.command//empty)|.[]|@base64' ${tmp}/${fqdn}-config.yml)
      command_index=0
      for command_as_base64 in ${command_list_as_base64[@]}; do
        command=$(echo ${command_as_base64} | base64 --decode)
        if [ "${action}" = "sync" ]; then
          ssh -o ConnectTimeout=1 -i ${ops_private_key} ${ops_username}@${fqdn} "${command}" &> /dev/null
          command_exit_code=$?
          echo "[${fqdn}:command ${command_index}] exit code: ${command_exit_code}, command: ${command}"
        else
          echo "[${fqdn}:command ${command_index}] skipped"
        fi
        command_index=$((command_index+1))
      done

      file_list_as_base64=$(yq -r  '.file//empty' ${tmp}/${fqdn}-config.yml | jq -r '.[] | @base64')
      file_index=0
      for file_as_base64 in ${file_list_as_base64[@]}; do
        file_source=$(_decode_property ${file_as_base64} .source)
        file_target=$(_decode_property ${file_as_base64} .target)
        file_sha256=$(_decode_property ${file_as_base64} .sha256)
        actual_sha256=$(ssh -o ConnectTimeout=1 -i ${ops_private_key} ${ops_username}@${fqdn} "sha256sum ${file_target} 2> /dev/null | cut -d ' ' -f 1")

        echo "[${fqdn}:file ${file_index}] target: ${file_target}, source: ${file_source}, sha256 expected: ${file_sha256}, actual: ${actual_sha256}"
        if [ "${file_sha256}" != "${actual_sha256}" ]; then
          file_pre_command_list_as_base64=$(_decode_property ${file_as_base64} '(.command.pre//empty)|.[]|@base64')
          command_index=0
          for file_pre_command_as_base64 in ${file_pre_command_list_as_base64[@]}; do
            command=$(echo ${file_pre_command_as_base64} | base64 --decode)
            echo "[${fqdn}:file ${file_index}, pre command ${command_index}] ${command}"
            if [ "${action}" = "sync" ]; then
              ssh -o ConnectTimeout=1 -i ${ops_private_key} ${ops_username}@${fqdn} "${command}" &> /dev/null
              command_exit_code=$?
              echo "[${fqdn}:file ${file_index}, pre command ${command_index}] exit code: ${command_exit_code}, command: ${command}"
            else
              echo "[${fqdn}:file ${file_index}, pre command ${command_index}] skipped"
            fi
            command_index=$((command_index+1))
          done
          if [ "${action}" = "sync" ]; then
            if ssh -o ConnectTimeout=1 -i ${ops_private_key} ${ops_username}@${fqdn} sudo curl -sLo ${file_target} ${file_source}; then
              echo "      ${fg_dim}download:${reset} ${fg_green}succeeded${reset}"
              echo "      ${fg_dim}commands (post):${reset}"
              file_post_command_list_as_base64=$(_decode_property ${file_as_base64} '(.command.post//empty)|.[]|@base64')
              command_index=0
              for file_post_command_as_base64 in ${file_post_command_list_as_base64[@]}; do
                command=$(echo ${file_post_command_as_base64} | base64 --decode)
                ssh -o ConnectTimeout=1 -i ${ops_private_key} ${ops_username}@${fqdn} "${command}" &> /dev/null
                command_exit_code=$?
                echo "[${fqdn}:file ${file_index}, post command ${command_index}] exit code: ${command_exit_code}, command: ${command}"
                command_index=$((command_index+1))
              done
            fi
          fi
        fi
      done
    else
      echo "[${fqdn}] config fetch failed"
    fi
  done
done
