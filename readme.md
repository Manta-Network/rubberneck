# rubberneck
### blockchain infrastructure management

this repository is the home of manta's blockchain infrastructure tooling. it consistes of several components:

- [api](https://github.com/Manta-Network/rubberneck/tree/main/api): a collection of aws lambdas which provide json snapshots of the state of the infrastructure landscape and its health
- [config](https://github.com/Manta-Network/rubberneck/tree/main/config): a collection of instance manifests which describe the configuration of each server maintained by rubberneck
- [daemon](https://github.com/Manta-Network/rubberneck/tree/main/daemon): a collection of systemd services that execute regular maintenance tasks (defined by the config component) on the servers maintained by rubberneck
- [static](https://github.com/Manta-Network/rubberneck/tree/main/static): a collection of configuration artifacts that are shared by multiple servers
- [web](https://github.com/Manta-Network/rubberneck/tree/main/web): a react web application hosted at https://status.manta.network, that serves as a status dashboard for the infrastructure maintained by rubberneck
