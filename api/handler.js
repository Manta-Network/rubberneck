'use strict';

//const { ApiPromise, WsProvider } = require("@polkadot/api");
//const Client = require('jsonrpc-websocket-client').JsonRpcWebSocketClient;
//import Client from "jsonrpc-websocket-client";
const MongoClient = require('mongodb').MongoClient;
const fetch = require('node-fetch');
const sslCertificate = require('get-ssl-certificate');

const rubberneckDbReadWrite = (process.env.rubberneck_db_readwrite);
const hetzner = {
  cloud: {
    calamari: (process.env.rubberneck_hetzner_calamari),
    dolphin: (process.env.rubberneck_hetzner_dolphin),
  },
  robot: {
    default: {
      username: (process.env.rubberneck_hetzner_robot_default_username),
      password: (process.env.rubberneck_hetzner_robot_default_password),
    }
  },
};
const country = {
  DE: 'Germany',
  FI: 'Finland',
  US: 'United States',
};
const project = {
  calamari: 1418177,
  dolphin: 1418181,
  manta: 1418182,
  infrastructure: 1418381,
};
const machine = {
  'AX41-NVMe': {
    price: {
      '2022-07-19': {
        hour: {
          amount: 36 * 12 / 365 / 24,
          currency: 'EUR'
        },
        month: {
          amount: 36,
          currency: 'EUR'
        },
      },
    },
  }
}
const history = {
  1813287: {
    launch: '2022-07-19T11:41:00Z',
    price: machine['AX41-NVMe'].price['2022-07-19'],
  },
  1813297: {
    launch: '2022-07-19T11:41:00Z',
    price: machine['AX41-NVMe'].price['2022-07-19'],
  },
  1814187: {
    launch: '2022-07-19T11:41:00Z',
    price: machine['AX41-NVMe'].price['2022-07-19'],
  },
  1814199: {
    launch: '2022-07-19T11:41:00Z',
    price: machine['AX41-NVMe'].price['2022-07-19'],
  },
  1814728: {
    launch: '2022-07-19T11:42:00Z',
    price: machine['AX41-NVMe'].price['2022-07-19'],
  },
  1814734: {
    launch: '2022-07-19T11:42:00Z',
    price: machine['AX41-NVMe'].price['2022-07-19'],
  },
  1814736: {
    launch: '2022-07-19T11:43:00Z',
    price: machine['AX41-NVMe'].price['2022-07-19'],
  },
  1814737: {
    launch: '2022-07-19T11:51:00Z',
    price: machine['AX41-NVMe'].price['2022-07-19'],
  },
}
const cache = {
  lifetime: 3600
};
const cacheAppend = (key, value) => {
  cache[key] = {
    expires: Date.now() + cache.lifetime * 1000,
    value
  };
}
const flag = (countryCode) => (
  String.fromCodePoint(...countryCode
    .toUpperCase()
    .split('')
    .map(char =>  127397 + char.charCodeAt()))
);
const datacenter = {
  'HEL1-DC3': {
    country: {
      code: 'FI',
      name: 'Finland',
      flag: flag('FI'),
    },
    city: {
      name: 'Helsinki',
    },
    latitude: 60.1719,
    longitude: 24.9347,
  },
  'HEL1-DC4': {
    country: {
      code: 'FI',
      name: 'Finland',
      flag: flag('FI'),
    },
    city: {
      name: 'Helsinki',
    },
    latitude: 60.1719,
    longitude: 24.9347,
  },
  'HEL1-DC6': {
    country: {
      code: 'FI',
      name: 'Finland',
      flag: flag('FI'),
    },
    city: {
      name: 'Helsinki',
    },
    latitude: 60.1719,
    longitude: 24.9347,
  },
  'FSN1-DC5': {
    country: {
      code: 'DE',
      name: 'Germany',
      flag: flag('DE'),
    },
    city: {
      name: 'Falkenstein',
    },
    latitude: 50.4777,
    longitude: 12.3649,
  },
  'FSN1-DC7': {
    country: {
      code: 'DE',
      name: 'Germany',
      flag: flag('DE'),
    },
    city: {
      name: 'Falkenstein',
    },
    latitude: 50.4777,
    longitude: 12.3649,
  },
  'FSN1-DC16': {
    country: {
      code: 'DE',
      name: 'Germany',
      flag: flag('DE'),
    },
    city: {
      name: 'Falkenstein',
    },
    latitude: 50.4777,
    longitude: 12.3649,
  },
};
const endpoints = {
  ops: 'https://7p1eol9lz4.execute-api.us-east-1.amazonaws.com/prod/instances',
  dev: 'https://mab48pe004.execute-api.us-east-1.amazonaws.com/prod/instances',
  service: 'https://l7ff90u0lf.execute-api.us-east-1.amazonaws.com/prod/instances',
  prod: 'https://hzhmt0krm0.execute-api.us-east-1.amazonaws.com/prod/instances'
};
const blockchains = [
  {
    name: 'baikal',
    domains: [
      'baikal.manta.systems',
    ],
    jobs: {
      invulnerable: [
        'baikal invulnerable validator (ssl)'
      ],
    },
    tier: 'relaychain',
  },
  {
    name: 'como',
    domains: [
      'como.manta.systems',
    ],
    jobs: {
      invulnerable: [
        'como invulnerable validator (ssl)'
      ],
    },
    tier: 'relaychain',
  },
  /*
  {
    name: 'dolphin',
    domains: [
      'dolphin.community',
    ],
    jobs: {
      invulnerable: [
        'dolphin/kusama invulnerable collator (ssl)'
      ],
    },
    tier: 'parachain',
    relay: 'kusama',
  },
  */
  {
    name: 'dolphin',
    domains: [
      'rococo.dolphin.engineering',
    ],
    jobs: {
      invulnerable: [
        'dolphin invulnerable collator (ssl)'
      ],
      full: [
        'dolphin full node (ssl)'
      ],
    },
    tier: 'parachain',
    relay: 'rococo',
  },
  {
    name: 'dolphin',
    domains: [
      'baikal.testnet.dolphin.training',
    ],
    jobs: {
      invulnerable: [
      ],
      full: [
      ],
    },
    tier: 'parachain',
    relay: 'baikal',
  },
  {
    name: 'calamari',
    domains: [
      'calamari.systems',
    ],
    jobs: {
      invulnerable: [
        'calamari invulnerable collator (ssl)',
        'calamari invulnerable collator (ssl) - node',
        'calamari invulnerable collator (ssl) - para',
        'calamari invulnerable collator (ssl) - relay'
      ],
      full: [
        'calamari full node (ssl)',
        'calamari full node (ssl) - node',
        'calamari full node (ssl) - para',
        'calamari full node (ssl) - relay'
      ],
      active: [
        'calamari community collator (ssl)',
        'calamari community collator',
      ],
      applicant: [
        'calamari experimental community collator (ssl)',
        'calamari experimental community collator',
      ],
    },
    tier: 'parachain',
    relay: 'kusama',
  },
  /*
  {
    name: 'manta',
    domains: [
      'manta.systems',
    ],
    jobs: {
      invulnerable: [
        'manta invulnerable collator (ssl)'
      ],
      full: [
        'manta full node (ssl)'
      ],
    },
    tier: 'parachain',
    relay: 'polkadot',
  },
  */
  {
    name: 'calamari-testnet',
    domains: [
      'baikal.testnet.calamari.systems',
    ],
    jobs: {
      invulnerable: [
        'calamari-testnet invulnerable collator (ssl)'
      ],
    },
    tier: 'parachain',
    relay: 'baikal',
  },
].map((b) => ({
    ...b,
    id: (b.tier === 'relay') ? b.name : `${b.relay}/${b.name}`,
  }))
  .sort((a, b) => (a.id > b.id) ? 1 : (a.id < b.id) ? -1 : 0);
const response = {
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Credentials': true,
    'Content-Type': 'application/json',
  },
};

// todo: determine invulnerables from prometheus job inclusion
const invulnerables = [
  'crispy',
  'crunchy',
  'hotdog',
  'tasty',
  'tender',
  'alfredi',
  'birostris',
  'eredoogootenkee',
  'hypostoma',
  'japanica',
  'eddie',
  'kwaltz',
  'prosser',
  'roosta',
  'zaphod',
];

const getRandomIntInclusive = (min, max) => {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1) + min);
}
const connectToDatabase = async () => {
  if (cache.db && cache.db.expires < Date.now()) {
    return cache.db.value;
  }
  //console.log(rubberneckDbReadWrite);
  const client = await MongoClient.connect(rubberneckDbReadWrite);
  const db = await client.db('rubberneck');
  cacheAppend('db', db);
  return db;
}
const fetchMachinePrices = async (machine) => {
  if (cache[machine] && cache[machine].expires < Date.now()) {
    return cache[machine].value;
  }
  const response = await fetch(`https://gist.githubusercontent.com/grenade/b03edb28bba5d3542a6b50b742318061/raw/price-${machine}.json`);
  const prices = await response.json();
  cacheAppend(machine, prices);
  return prices;
};
const fetchProfileInstances = async (profile) => {
  const response = await fetch(endpoints[profile]);
  const json = await response.json();
  return Promise.all(json.instances.map(async (i) => {
    const prices = await fetchMachinePrices(i.machine);
    return {
      provider: 'amazon',
      profile,
      ...i,
      price: {
        hour: {
          amount: prices.find((p) => p.region === i.region).price,
          currency: 'USD',
        }
      }
    };
  }));
};
const fetchShockDedicatedInstances = () => {
  return [
    {
      provider: 'shock-dedicated',
      profile: 'default',
      project: 'default',
      region: 'singapore',
      image: 'ubuntu-20-04',
      fqdn: 'c5.calamari.systems',
      hostname: 'c5',
      domain: 'calamari.systems',
      id: '29005',
      ip: '210.16.67.146',
      machine: 'SG-DH2',
      launch: '2022-08-25T07:12:00Z',
      location: {
        az: 'singapore',
        country: {
          code: 'SG',
          name: 'Singapore',
          flag: flag('SG'),
        },
        city: {
          name: 'Singapore',
        },
        latitude: '1.3036',
        longitude: '103.8554',
      },
      price: {
        hour: {
          amount: 60 * 12 / 365 / 24,
          currency: 'USD',
        },
        month: {
          amount: 60,
          currency: 'USD',
        }
      },
    },
    {
      provider: 'shock-dedicated',
      profile: 'default',
      project: 'default',
      region: 'singapore',
      image: 'ubuntu-20-04',
      fqdn: 'f5.calamari.systems',
      hostname: 'f5',
      domain: 'calamari.systems',
      id: '29008',
      ip: '210.16.67.186',
      machine: 'SG-DS2',
      launch: '2022-08-25T07:33:00Z',
      location: {
        az: 'singapore',
        country: {
          code: 'SG',
          name: 'Singapore',
          flag: flag('SG'),
        },
        city: {
          name: 'Singapore',
        },
        latitude: '1.3036',
        longitude: '103.8554',
      },
      price: {
        hour: {
          amount: 60 * 12 / 365 / 24,
          currency: 'USD',
        },
        month: {
          amount: 60,
          currency: 'USD',
        }
      },
    },
  ];
};
const fetchHetznerCloudInstances = async (profile) => {
  /*
  curl \
    -H "Authorization: Bearer $(pass manta/hetzner/api-token/calamari/manta-ci)" \
    https://api.hetzner.cloud/v1/servers
  */
  let servers;
  try {
    const response = await fetch(
      `https://api.hetzner.cloud/v1/servers`,
      {
        headers:  {
          Authorization: `Bearer ${hetzner.cloud[profile]}`
        }
      }
    );
    const json = await response.json();
    servers = json.servers;
  } catch {
    servers = undefined;
  }
  if (!servers || !servers.length) {
    return [];
  }
  return servers.map((server) => {
    const instance = {
      provider: 'hetzner-cloud',
      profile,
      project: project[profile],
      launch: server.created,
      hostname: server.name.split('.')[0],
      domain: server.name.split('.').slice(1).join('.'),
      fqdn: server.name,
      id: server.id,
      ip: server.public_net.ipv4.ip,
      state: server.status,
      machine: server.server_type.name,
      region: `${server.datacenter.location.network_zone}-${server.datacenter.location.id}`,
      image: server.image,
      location: {
        az: server.datacenter.location.name,
        country: {
          code: server.datacenter.location.country,
          name: country[server.datacenter.location.country],
          flag: flag(server.datacenter.location.country),
        },
        city: {
          name: server.datacenter.location.city,
        },
        latitude: server.datacenter.location.latitude,
        longitude: server.datacenter.location.longitude,
      },
      price: {
        hour: {
          amount: server.server_type.prices.find((p) => p.location === server.datacenter.location.name).price_hourly.gross,
          currency: 'EUR',
        },
        month: {
          amount: server.server_type.prices.find((p) => p.location === server.datacenter.location.name).price_monthly.gross,
          currency: 'EUR',
        }
      },
    };
    return instance;
  });
};
const fetchHetznerRobotInstances = async (profile) => {
  /*
  curl \
    -u $(pass manta/hetzner/robot/default/username):$(pass manta/hetzner/robot/default/password) \
    https://robot-ws.your-server.de/server
  */
  let items;
  try {
    const response = await fetch(
      `https://robot-ws.your-server.de/server`,
      {
        method: 'GET',
        headers:  {
          Authorization: `Basic ${Buffer.from(`${hetzner.robot[profile].username}:${hetzner.robot[profile].password}`).toString('base64')}`
        }
      }
    );
    items = await response.json();
  } catch {
    items = [];
  }
  if (items === undefined || !!items.error) {
    return [];
  }
  return items.map((item) => {
    const { server } = item;
    const instance = {
      provider: 'hetzner-robot',
      profile,
      ...(!!server.server_name) && {
        hostname: server.server_name.split('.')[0],
        domain: server.server_name.split('.').slice(1).join('.'),
        fqdn: server.server_name,
      },
      id: server.server_number,
      ip: server.server_ip,
      state: server.status,
      machine: server.product,
      region: `eu-central-${server.dc.split('-')[0]}`,
      location: {
        az: server.dc,
        ...datacenter[server.dc],
      },
      ...history[server.server_number],
    };
    return instance;
  });
};
const fetchInstances = async () => {
  if (!cache.instances || !cache.instances.length || cache.instances.expires < Date.now()) {
    const [ awsInstances, hetznerRobotInstances, hetznerCloudInstances ] = await Promise.all([
      Promise.all(Object.keys(endpoints).map((profile) => fetchProfileInstances(profile))),
      Promise.all([fetchHetznerRobotInstances('default')]),
      Promise.all(Object.keys(hetzner.cloud).map((profile) => fetchHetznerCloudInstances(profile))),
    ]);
    const instances = [
      ...awsInstances.reduce((a, b) => [...a, ...b], []),
      ...hetznerRobotInstances.reduce((a, b) => [...a, ...b], []),
      ...hetznerCloudInstances.reduce((a, b) => [...a, ...b], []),
      ...fetchShockDedicatedInstances(),
    ];
    cacheAppend('instances', instances);
  }
  return cache.instances.value;
};
const fetchTargets = async () => {
  if (!cache.targets || !cache.targets.length || cache.targets.expires < Date.now()) {
    const response = await fetch(`https://pulse.pelagos.systems/api/v1/targets`);
    const json = await response.json();
    const targets = json.data.activeTargets.map(t => ({
      ...t,
      fqdn: t.labels.instance.split(':')[0].replace(/(para|relay|calamari|kusama|dolphin|rococo|manta|polkadot)\.metrics\./, '')
    }));
    cacheAppend('targets', targets);
  }
  return cache.targets.value;
};
const fetchChainNodes = async (relaychain, parachain) => {
  const blockchain = (!!parachain)
    ? blockchains.find((b) => b.name === parachain && b.relay === relaychain)
    : blockchains.find((b) => b.name === relaychain);
  const [ instances, targets ] = [ await fetchInstances(), await fetchTargets() ];
  const jobs = Object.values(blockchain.jobs).reduce((a, b) => [...a, ...b], []);
  const chainTargets = targets.filter(t => jobs.includes(t.scrapePool));
  const nodes = instances
    .filter(i => blockchain.domains.includes(i.domain))
    .map(i => ({
      ...i,
      roles: invulnerables.includes(i.hostname) ? ['invulnerable'] : ['full'],
      metrics: {
        node: chainTargets.find(t => t.fqdn === i.fqdn && (
            t.discoveredLabels.__metrics_path__ === '/node/metrics'
            ||
            (t.discoveredLabels.__metrics_path__ === '/metrics' && t.discoveredLabels.__address__ === t.fqdn)
          )),
        ...(blockchain.tier === 'parachain') && {
          para: chainTargets.find(t => t.fqdn === i.fqdn && (
            t.discoveredLabels.__metrics_path__ === '/para/metrics'
            ||
            t.discoveredLabels.__address__ === `para.metrics.${t.fqdn}`
            ||
            (new RegExp(`/${blockchain.name}.*\\.${t.fqdn}/`)).test(t.fqdn)
          ))
        },
        ...(blockchain.tier === 'parachain') && {
          relay: chainTargets.find(t => t.fqdn === i.fqdn && (
            t.discoveredLabels.__metrics_path__ === '/relay/metrics'
            ||
            t.discoveredLabels.__address__ === `relay.metrics.${t.fqdn}`
            || 
            (new RegExp(`/${blockchain.relay}.*\\.${t.fqdn}/`)).test(t.fqdn)
          ))
        },
      }
    }));
  return nodes;
};
const fetchAllNodes = async () => {
  const [ instances, targets ] = [ await fetchInstances(), await fetchTargets() ];
  const nodes = instances
    .map(i => {
      const blockchain = blockchains.find((b) => b.domains.includes(i.domain));
      return {
        ...i,
        roles: invulnerables.includes(i.hostname)
          ? ['invulnerable']
          : (!!blockchain)
            ? ['full']
            : (!!i.domain.split('.').includes('telemetry'))
              ? ['telemetry']
              : [],
        metrics: {
          node: targets.find(t => (
            (t.discoveredLabels.__metrics_path__ === '/metrics' && t.discoveredLabels.__address__ === t.fqdn)
            ||
            (t.discoveredLabels.__metrics_path__ === '/node/metrics')
          )),
          ...((!!blockchain) && (blockchain.tier === 'parachain')) && {
            para: targets.find(t => t.fqdn === i.fqdn && (
              t.discoveredLabels.__metrics_path__ === '/para/metrics'
              ||
              t.discoveredLabels.__address__ === `para.metrics.${t.fqdn}`
              ||
              (new RegExp(`/${blockchain.name}.*\\.${t.fqdn}/`)).test(t.fqdn)
            ))
          },
          ...((!!blockchain) && (blockchain.tier === 'parachain')) && {
            relay: targets.find(t => t.fqdn === i.fqdn && (
              t.discoveredLabels.__metrics_path__ === '/relay/metrics'
              ||
              t.discoveredLabels.__address__ === `relay.metrics.${t.fqdn}`
              || 
              (new RegExp(`/${blockchain.relay}.*\\.${t.fqdn}/`)).test(t.fqdn)
            ))
          },
        }
      };
    });
  return nodes;
};
const fetchInstanceMetrics = async (key, instance) => {
  const url = {
    scheme: 'https',
    hostname: 'pulse.pelagos.systems',
    path: 'api/v1/query',
    params: new URLSearchParams({
      query: `{instance="${instance}"}`
    }).toString(),
  };
  const response = await fetch(`${url.scheme}://${url.hostname}/${url.path}?${url.params}`);
  const json = await response.json();
  return {
    key,
    ...(json.status === 'success' && !!json.data && !!json.data.result && !!json.data.result.length) && {
      result: json.data.result
    },
  };
};
const fetchParsedMetrics = async (key, fqdn) => {
  const response = await fetch(`https://metrics.sparta.pelagos.systems/${fqdn}/${key}.json`);
  const result = await response.json();
  return {
    key,
    result,
  };
};
const fetchNode = async (fqdn) => {
  const certificate = await sslCertificate.get(fqdn);
  const [ instance, targets ] = [
    (await fetchInstances()).find(t => t.fqdn === fqdn),
    (await fetchTargets()).filter(t => t.fqdn === fqdn),
  ];
  //const wsResponses = await fetchWebsocketResponses(instance.fqdn, [{ method: 'system_localPeerId' }, { method: 'system_health' }]);
  const blockchain = blockchains.find((b) => b.domains.includes(instance.domain));
  const metrics = {
    ...targets.some((t) => t.discoveredLabels.__address__ === t.fqdn) && {
      node: targets.find((t) => t.discoveredLabels.__address__ === t.fqdn)
    },
    ...targets.some((t) => t.discoveredLabels.__address__ === `para.metrics.${t.fqdn}`) && {
      para: targets.find((t) => t.discoveredLabels.__address__ === `para.metrics.${t.fqdn}`)
    },
    ...targets.some((t) => t.discoveredLabels.__address__ === `relay.metrics.${t.fqdn}`) && {
      relay: targets.find((t) => t.discoveredLabels.__address__ === `relay.metrics.${t.fqdn}`)
    },
  };
  const latestMetrics = await Promise.all(Object.keys(metrics).map((key) => fetchInstanceMetrics(key, metrics[key].labels.instance)));
  latestMetrics.forEach((lm) => {
    if (!!lm.result) {
      metrics[lm.key].latest = lm.result;
    }
  });
  const parsedMetrics = await Promise.all(Object.keys(metrics).map((key) => fetchParsedMetrics(key, fqdn)));
  parsedMetrics.forEach((pm) => {
    if (!!pm.result) {
      metrics[pm.key].parsed = pm.result;
    }
  });

  const node = {
    ...instance,
    //wsResponses,
    roles: invulnerables.includes(instance.hostname) ? ['invulnerable'] : ['full'],
    blockchain: {
      name: blockchain.name,
      tier: blockchain.tier,
      relay: blockchain.relay,
    },
    certificate,
    metrics,
  };
  return node;
};
const fetchObservations = async (fqdn) => {
  //console.log(`fetchObservations('${fqdn}')`);
  const db = await connectToDatabase();
  const observations = await db.collection('observation').aggregate([
    {
      $match: {
        fqdn,
        observed: {
          $gt: new Date(new Date().setDate(new Date().getDate()-1))
        }
      }
    },
    {
      $project: {
        _id: false,
        observed: true,
        cert_validity_days: { $trunc: { $divide: [{ $subtract: ["$cert.expiry", "$observed"] }, 1000 * 60 * 60 * 24] } },
        peers_connected: { $cond: [ { $not: ["$node.peers"] }, 0, "$node.peers" ] },
        websocket_redponsive: { $cond: [{ $not: ["$node.id"] }, false, true] },
        sync_in_progress: { $cond: [{ $or: [ { $eq: ["$syncing.para", true] }, { $eq: ["$syncing.relay", true] } ] }, true, false] }
      }
    }
  ]).sort({observed:-1}).limit(60).sort({observed:1}).toArray();
  /*
  const observationCount = 90;
  const observations = [...Array(observationCount).keys()].map((i) => {
    const [ peers_connected, cert_validity_days ] = [
      getRandomIntInclusive(0, 12),
      (observationCount - i),
    ];
    return {
      //observed: new Date('2022-07-05T09:14:19.562Z'),
      cert_validity_days,
      peers_connected,
      websocket_redponsive: (peers_connected > 0) && !!getRandomIntInclusive(0, 7)
    };
  });
  */
  return observations;
};
/*
const fetchWebsocketResponses = async (fqdn, requests) => {
  const client = new Client(`wss://${fqdn}/`);
  client.on("notification", (notification) => {
    console.log("notification", notification);
  });
  console.log(client.status);
  await client.open();
  console.log(client.status);
  //const responses = await Promise.all(requests.map(r => client.call(r.method, r.params)));
  const responses = [ await client.call(requests[0].method, requests[0].params) ];
  await client.close();
  console.log(client.status);
  return {
    fqdn,
    responses,
  };
};
const fetchHealth = async () => {
  const instances = await fetchInstances();
  const blockchainNodes = instances
    .map(i => {
      const { fqdn } = i;
      const blockchain = blockchains.find((b) => b.domains.includes(i.domain));
      return (!!blockchain)
        ? {
            fqdn,
            blockchain: {
              id: blockchain.id,
              name: blockchain.name,
              tier: blockchain.tier,
              relay: blockchain.relay,
            },
          }
        : i;
    })
    .filter((i) => !!i.blockchain);

  const [ certificates, wsResponseSets ] = await Promise.all([
    Promise.all(blockchainNodes.map((n) => sslCertificate.get(n.fqdn))),
    Promise.all(blockchainNodes.map((n) => fetchWebsocketResponses(n.fqdn, [{ method: 'system_localPeerId' }, { method: 'system_health' }]))),
  ]);

  const health = blockchainNodes
    .map(n => {
      const certificate = certificates.find((c) => c.subject.CN === n.fqdn);
      const wsResponses = wsResponseSets.find((x) => x.fqdn === n.fqdn);
      return {
        ...n,
        wsResponses,
        ...(!!certificate) && {
          certificate: {
            name: certificate.subject.CN,
            valid: {
              from: new Date(certificate.valid_from).toISOString(),
              to: new Date(certificate.valid_to).toISOString(),
              for: certificate.subjectaltname.replace(/DNS:/g, '').split(', ')
            }
          },
          apis
        },
      }
    });
  return health;
};
*/

module.exports.blockchains = async (event) => {
  let error;
  const body = {
    blockchains,
    error,
  };
  return {
    ...response,
    statusCode: (!!error) ? 500 : 200,
    body: JSON.stringify(body, null, 2),
  };
};

module.exports.nodes = async (event) => {
  const { relaychain, parachain } = event.pathParameters;
  const nodes = (relaychain === 'all')
    ? await fetchAllNodes()
    : await fetchChainNodes(relaychain, parachain);
  let error;
  const body = {
    nodes,
    error,
  };
  return {
    ...response,
    statusCode: (!!error) ? 500 : 200,
    body: JSON.stringify(body, null, 2),
  };
}

module.exports.node = async (event) => {
  const { fqdn } = event.pathParameters;
  const node = await fetchNode(fqdn);
  let error;
  const body = {
    node,
    error,
  };
  return {
    ...response,
    statusCode: (!!error) ? 500 : 200,
    body: JSON.stringify(body, null, 2),
  };
}

module.exports.observations = async (event) => {
  const { fqdn } = event.pathParameters;
  const observations = await fetchObservations(fqdn);
  let error;
  const body = {
    observations,
    error,
  };
  return {
    ...response,
    statusCode: (!!error) ? 500 : 200,
    body: JSON.stringify(body, null, 2),
  };
}

/*
module.exports.health = async (event) => {
  const health = await fetchHealth();
  let error;
  const body = {
    health,
    error,
  };
  return {
    ...response,
    statusCode: (!!error) ? 500 : 200,
    body: JSON.stringify(body, null, 2),
  };
}
*/
