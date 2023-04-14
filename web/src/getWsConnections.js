
const getActive = async (fqdn) => {
  let active;
  try {
    // https://substrate.stackexchange.com/questions/3027/add-current-ws-connection-number-metric
    const response = await fetch(`https://pulse.pelagos.systems/api/v1/query?query=substrate_rpc_sessions_opened{instance%3D%22${fqdn}:443%22}-substrate_rpc_sessions_closed{instance%3D%22${fqdn}:443%22}`);
    const json = await response.json();
    active = json.data.result[0].value[1];
  } catch(exception) {
    active = 0;
  }
  return parseInt(active);
};

const getMax = async (fqdn) => {
  let max;
  const config = {
    hostname: fqdn.split('.')[0],
    domain: fqdn.split('.').slice(1).join('.'),
    regex: /ws-max-connections ([0-9]+) /,
  };
  switch (config.domain) {
    case 'baikal.manta.systems':
      config.unit = 'baikal';
      config.nodesPerInstance = 1;
      break;
    case 'baikal.testnet.calamari.systems':
    case 'calamari.moonsea.systems':
    case 'calamari.seabird.systems':
    case 'calamari.systems':
      config.unit = 'calamari';
      config.nodesPerInstance = 1;
      break;
    case 'baikal.testnet.dolphin.training':
    case 'dolphin.engineering':
    case 'dolphin.seabird.systems':
      config.unit = 'dolphin';
      config.nodesPerInstance = 1;
      break;
    case 'acala.seabird.systems':
      config.unit = 'karura';
      config.nodesPerInstance = 1;
      break;
    case 'internal.kusama.systems':
      switch (config.hostname[0]) {
        case 'a':
          config.unit = 'kusama-0';
          break;
        default:
          config.unit = 'kusama0';
          break;
      }
      config.nodesPerInstance = 3;
      break;
    case 'manta.systems':
      config.unit = 'manta';
      config.nodesPerInstance = 1;
      break;
    case 'moonriver.seabird.systems':
      config.unit = 'moonriver';
      config.nodesPerInstance = 1;
      break;
    default:
      config.unit = 'calamari';
      config.nodesPerInstance = 1;
      break;
  }
  config.unitPrefix = (config.domain === 'calamari.systems') ? 'usr/lib' : 'etc';
  try {
    const response = await fetch(`https://raw.githubusercontent.com/Manta-Network/rubberneck/main/config/${config.domain}/${config.hostname}/${config.unitPrefix}/systemd/system/${config.unit}.service`);
    const text = await response.text();
    max = (config.nodesPerInstance * text.match(config.regex)[1]);
  } catch (_) {
    try {
      max = (config.nodesPerInstance * (await (await fetch(`https://raw.githubusercontent.com/Manta-Network/rubberneck/main/config/${config.domain}/${config.hostname}/${(config.unitPrefix === 'usr/lib') ? 'etc' : 'usr/lib'}/systemd/system/${config.unit}.service`)).text()).match(config.regex)[1]);
    } catch (_) {
      max = 100;
    }
  }
  return max;
};

const getWsConnections = async (fqdn) => {
  const [ active, max ] = await Promise.all([ getActive(fqdn), getMax(fqdn) ]);
  return { active, max };
};

export default getWsConnections;
