#!/usr/bin/env bash

# usage: curl -sL https://raw.githubusercontent.com/Manta-Network/rubberneck/main/daemon/cert-fix.sh | bash

systemctl status nginx.service
sudo certbot certificates
sudo ls -ahl /etc/letsencrypt/{live,archive,renewal}

for incorrect_cert_name in rpc.$(hostname -f) para.metrics.$(hostname -f) relay.metrics.$(hostname -f) $(hostname -f)-0001; do
  if sudo certbot certificates | grep "Certificate Name: ${incorrect_cert_name}"; then
    sudo certbot delete --cert-name ${incorrect_cert_name}
  fi
  sudo sed -i \
    "s#/etc/letsencrypt/live/${incorrect_cert_name}/#/etc/letsencrypt/live/$(hostname -f)/#g" \
    /etc/nginx/sites-available/*
  sudo rm -rf /etc/letsencrypt/{live,archive}/${incorrect_cert_name}
  sudo rm -f /etc/letsencrypt/renewal/${incorrect_cert_name}.conf
done

# resolve missing cert paths
sudo sed -i \
  "s#ssl_certificate ;#ssl_certificate /etc/letsencrypt/live/$(hostname -f)/fullchain.pem;#g" \
  /etc/nginx/sites-available/*
sudo sed -i \
  "s#ssl_certificate_key ;#ssl_certificate_key /etc/letsencrypt/live/$(hostname -f)/privkey.pem;#g" \
  /etc/nginx/sites-available/*

# resolve duplicate hostnames in server_name
sudo sed -i \
  "s/server_name $(hostname -f) $(hostname -f)/server_name $(hostname -f)/g" \
  /etc/nginx/sites-available/*

# resolve long domain name nginx issues
sudo sed -i \
  "s/# server_names_hash_bucket_size 64;/server_names_hash_bucket_size 128;/" \
  /etc/nginx/nginx.conf

# create cert renewal config
cert_name=$(hostname -f)
client_version=$(certbot --version | cut -d ' ' -f2)
client_account=$(sudo ls /etc/letsencrypt/accounts/acme-v02.api.letsencrypt.org/directory)

sudo bash -c "cat << EOF > /etc/letsencrypt/renewal/${cert_name}.conf
# renew_before_expiry = 30 days
version = ${client_version}
archive_dir = /etc/letsencrypt/archive/${cert_name}
cert = /etc/letsencrypt/live/${cert_name}/cert.pem
privkey = /etc/letsencrypt/live/${cert_name}/privkey.pem
chain = /etc/letsencrypt/live/${cert_name}/chain.pem
fullchain = /etc/letsencrypt/live/${cert_name}/fullchain.pem
# Options used in the renewal process
[renewalparams]
account = ${client_account}
pref_challs = http-01,
authenticator = standalone
server = https://acme-v02.api.letsencrypt.org/directory
EOF"
sudo systemctl stop nginx.service
sudo certbot renew --no-random-sleep-on-renew
sudo systemctl start nginx.service
systemctl status nginx.service
sudo ls -ahl /etc/letsencrypt/{live,archive,renewal}
sudo certbot certificates
