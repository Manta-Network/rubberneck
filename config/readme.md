# [rubberneck](https://github.com/Manta-Network/rubberneck) / config

### a collection of instance manifests and configuration artifacts which describe the configuration of each server maintained by rubberneck

this rubberneck component uses several **imperative** conventions:

- each rubberneck server is grouped into *subdomain* based *intention* subfolders
  - a *subdomain* is used to classify an *intention*
    - in this implementation of rubberneck:
      - an *intention* may include multiple *subdomains*
      - a *subdomain* may only encompass a single *intention*
  - an *intention* is a purpose or justification for existence. for example:
    - peering on the calamari parachain which runs on the kusama relay-chain is an *intention*
    - gathering and displaying telemetry for staging blockchains is an *intention*.
  - some examples of *subdomains* include:
    - calamari.systems: a *subdomain* which includes server instances that archive and collate the calamari parachain which runs on the kusama relay-chain
    - internal.kusama.systems: a *subdomain* which includes server instances that archive and collate the kusama-internal relay-chain
- folders under the config component directory are named using the *subdomain* name of the servers managed therein
- folders under the config/*subdomain* directory are named using the hostname of the individual servers within that *subdomain*. ie:
  - [config/calamari.systems/a1](calamari.systems/a1) contains the manifest ([config/calamari.systems/a1/config.yml](calamari.systems/a1/config.yml)) and configuration artifacts (eg: [config/calamari.systems/a1/etc/nginx/sites-available/substrate.conf](calamari.systems/a1/etc/nginx/sites-available/substrate.conf)) for the server with hostname: `a1` and fully qualified domain name (fqdn): `a1.calamari.systems`
- *intention* synchronisations are atomic. that is to say that:
  - an *intention* does not depend on other *intentions*
  - an entire *intention* can be and is regularly synchronised with the head of the rubberneck repository and may occur in parallel with other *intention* synchronisations
  - *subdomains* within an *intention* are synchronised in alphabetical sequence
  - servers within a *subdomain* are synchronised in alphabetical sequence
  - the synchronous sequentiality within *intentions* is intentional. the rational is that multiple servers within an *intention* should not be offline at the same time. for example:
    - blockchain validators or collators on the same network or chain require frequent updates but if all nodes went offline in parallel in order to perform an upgrade, the blockchain network might pause or stop completely if no new blocks are authored during the maintenance window
    - telemetry or log aggregators may load balance multiple listener instances. performing updates in sequence allows normal operation of the load-balanced listening, while an individual instance is performing its maintenance

## manifest (`config.yml`)

each server maintained by rubberneck must include a manifest. the manifest must be named `config.yml` and must be available in the rubberneck repository at the conventional path which is: `config/${subdomain}/${hostname}/config.yml`. for example: [config/calamari.systems/a1/config.yml](calamari.systems/a1/config.yml)

the structure of a server manifest is loosely based on [cloudinit/cloud-config](https://cloudinit.readthedocs.io/en/latest/reference/examples.html) with the notable difference that rubberneck manifests are intended to be run on the same instance repeatedly and frequently. the syntax and conventions for an example instance (`a1.example.com`) are as follows:

```yaml
---

# values other than `sync` will notify the synchronisation service to work in dry-run mode which operates as a read-only mechanism, producing log output but making no changes to the server
action: sync

dns:
  # dns alias record(s) configuration used to include this server as a peer node within a group of load balanced peers
  # two implementations of the synchronisation service exist, one for aws route53 another for cloudflare dns
  alias:
    # example of an aws route53 dns load balancing entry
    -
      # a dns load-balanced entry for `a.example.com` will be created as a weighted alias of a1.example.com
      name: a.example.com
      # the dns entry load balancer weighting (a value between 0 and 255 inclusive).
      # 0: no dns queries for a.example.com will be routed to a1.example.com
      # 128: some dns queries for a.example.com will be routed to a1.example.com
      # 255: many dns queries for a.example.com will be routed to a1.example.com
      weight: 200
    # example of a cloudflare dns load balancing entry
    -
      # a dns A record for `a.example.com` will be created with the ip address of a1.example.com
      name: a.example.com

# a list of packages to be installed by the servers distribution package manager, ie: apt, dnf
# packages listed here must be available from a repository already known to the server, ie: from the distribution's default repository list
package:
  # the synchronisation server will install the `unzip` package if it is not already installed
  - unzip

user:
  -
    username: root
    # include the keys listed here in: `/root/.ssh/authorized_keys`, remove any keys from that file which are not listed here
    # either or both of the `keys` or `users` properties may be populated or omitted. the authorized_keys file will be deduped before deployment
    authorized:
      # include lines in authorized_keys with the exact key strings in this list
      keys:
        - ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIMX86IrraXnF9i2j2vK9hbRupKmwJg4kTX1wSypF/9wz
      # fetch ed25519 keys for each user listed here from github, eg: https://github.com/alice.keys
      users:
        - alice
  -
    username: ubuntu
    # include the keys listed here in: `/home/ubuntu/.ssh/authorized_keys`, remove any keys from that file which are not listed here
    # either or both of the `keys` or `users` properties may be populated or omitted. the authorized_keys file will be deduped before deployment
    authorized:
      # include lines in authorized_keys with the exact key strings in this list
      keys:
        - ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIDHHFs7S2Kvt9FlToRkJRstWjxeiR2DLbw6aAo1Vex2z
      # fetch ed25519 keys for each user listed here from github, eg: https://github.com/bob.keys, https://github.com/charlie.keys
      users:
        - bob
        - charlie

# each command in this list will be executed on each iteration of the synchronisation service
command:
  # disable password based access to the root account. ed25519 ssh key access will still be available for rsync and other root maintenance
  - sudo passwd -l root
  # attempt to restart the nginx systemd service, if it is not observed to be in an `active` state
  - systemctl is-active nginx.service || sudo systemctl restart nginx.service
  # download and install the promtail binary if the executable is not detected. note that care has been taken in the crafting of this command to account for the download and install steps being skipped if the binary is already present and executable
  - test -x /usr/local/bin/promtail-linux-amd64 || ( curl -Lo /tmp/promtail-linux-amd64.zip https://github.com/grafana/loki/releases/download/v2.6.1/promtail-linux-amd64.zip && sudo unzip /tmp/promtail-linux-amd64.zip -d /usr/local/bin )

# each file in this list will be downloaded from the uri specified by `source` to the path specified by `target`, if a file does not already exist at that path with a checksum matching the checksum specified by `sha256`
# notes:
# - on linux, a sha256 checksum for a given file can be observed with a command like `sha256sum ${file}`
# - pre and post commands are only executed if the file download is required. they are skipped if the target with correct checksum already exists
# - the command, pre and post properties can be ommitted completely if installation of the file does not require them
file:
  # create a new systemd service for promtail (by creating the promtail.service file), if it doesn't already exist
  -
    source: https://gist.githubusercontent.com/grenade/74b5da418ac15b3c9679c1ec6b16f821/raw/promtail.service
    target: /etc/systemd/system/promtail.service
    sha256: 35ab9c5313c3729bf7cdedde972cf7b6e566d75bc5789edd88ab034a4e14096a
    command:
      pre:
        # before replacing an existing promtail.service file (with a different checksum), stop the promtail service, if it is observed to be in the active state
        - ( systemctl is-active --quiet promtail.service && sudo systemctl stop promtail.service ) || true
      post:
        # changes to a systemd unit file always require a systemd daemon-reload
        - sudo systemctl daemon-reload
        # enable the service, if it is not already enabled
        - systemctl is-enabled --quiet promtail.service || sudo systemctl enable promtail.service
        # start the service, if it is not already started
        - systemctl is-active --quiet promtail.service || sudo systemctl start promtail.service

  # create a new promtail configuration (by creating the promtail.yml file), if it doesn't already exist
  -
    source: https://gist.githubusercontent.com/grenade/74b5da418ac15b3c9679c1ec6b16f821/raw/promtail.yml
    target: /etc/promtail/promtail.yml
    sha256: 3ad396de6e1becc80616339a413c0c1c8e21f96a3ceba2294521fac26941a52e
    command:
      pre:
        # create the promtail configuration folder
        - sudo mkdir -p /etc/promtail
        # since we are changing the service configuration, stop the promtail service, if it is observed to be in the active state
        - ( systemctl is-active --quiet promtail.service && sudo systemctl stop promtail.service ) || true
      post:
        # start the service, if it is not already started
        - systemctl is-active --quiet promtail.service || sudo systemctl start promtail.service
```
