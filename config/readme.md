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
