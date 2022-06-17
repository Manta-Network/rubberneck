'use strict';

const fetch = require('node-fetch');
const cache = {
  lifetime: 3600
};
const cacheAppend = (key, value) => {
  cache[key] = {
    expires: Date.now() + cache.lifetime * 1000,
    value
  };
}
const endpoints = {
  ops: 'https://7p1eol9lz4.execute-api.us-east-1.amazonaws.com/prod/instances',
  dev: 'https://mab48pe004.execute-api.us-east-1.amazonaws.com/prod/instances',
  service: 'https://l7ff90u0lf.execute-api.us-east-1.amazonaws.com/prod/instances',
  prod: 'https://hzhmt0krm0.execute-api.us-east-1.amazonaws.com/prod/instances'
};
const blockchains = [
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
    name: 'calamari',
    domains: [
      'calamari.systems',
    ],
    jobs: {
      invulnerable: [
        'calamari invulnerable collator (ssl)'
      ],
      full: [
        'calamari full node (ssl)'
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
].sort((a, b) => (a.name > b.name) ? 1 : (a.name < b.name) ? -1 : (a.relay > b.relay) ? 1 : (a.relay < b.relay) ? -1 : 0);
const response = {
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Credentials': true,
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

const fetchProfileInstances = async (profile) => {
  const response = await fetch(endpoints[profile]);
  const json = await response.json();
  return json.instances.map(i => ({...i, profile}));
};
const fetchInstances = async () => {
  if (!cache.instances || !cache.instances.length || cache.instances.expires < Date.now()) {
    const instancesPromises = await Promise.all(Object.keys(endpoints).map((profile) => fetchProfileInstances(profile)));
    const instances = instancesPromises.reduce((a, b) => [...a, ...b], []);
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
        node: chainTargets.find(t => t.fqdn === i.fqdn && t.discoveredLabels.__address__ === t.fqdn),
        ...(blockchain.tier === 'parachain') && {
          para: chainTargets.find(t => t.fqdn === i.fqdn && (
            t.discoveredLabels.__address__ === `para.metrics.${t.fqdn}` || (new RegExp(`/${blockchain.name}.*\\.${t.fqdn}/`)).test(t.fqdn)
          ))
        },
        ...(blockchain.tier === 'parachain') && {
          relay: chainTargets.find(t => t.fqdn === i.fqdn && (
            t.discoveredLabels.__address__ === `relay.metrics.${t.fqdn}` || (new RegExp(`/${blockchain.relay}.*\\.${t.fqdn}/`)).test(t.fqdn)
          ))
        },
      }
    }));
  return nodes;
};
const fetchNode = async (fqdn) => {
  const [ instance, targets ] = [
    (await fetchInstances()).find(t => t.fqdn === fqdn),
    (await fetchTargets()).filter(t => t.fqdn === fqdn),
  ];
  const blockchain = blockchains.find((b) => b.domains.includes(instance.domain));
  const node = {
    ...instance,
    roles: invulnerables.includes(instance.hostname) ? ['invulnerable'] : ['full'],
    blockchain: {
      name: blockchain.name,
      tier: blockchain.tier,
      relay: blockchain.relay,
    },
    metrics: {
      ...targets.some((t) => t.discoveredLabels.__address__ === t.fqdn) && {
        node: targets.find((t) => t.discoveredLabels.__address__ === t.fqdn)
      },
      ...targets.some((t) => t.discoveredLabels.__address__ === `para.metrics.${t.fqdn}`) && {
        para: targets.find((t) => t.discoveredLabels.__address__ === `para.metrics.${t.fqdn}`)
      },
      ...targets.some((t) => t.discoveredLabels.__address__ === `relay.metrics.${t.fqdn}`) && {
        relay: targets.find((t) => t.discoveredLabels.__address__ === `relay.metrics.${t.fqdn}`)
      },
    }
  };
  return node;
};

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
  const nodes = await fetchChainNodes(relaychain, parachain);
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
