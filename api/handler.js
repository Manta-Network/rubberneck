'use strict';

const MongoClient = require('mongodb').MongoClient;
const fetch = require('node-fetch');
const sslCertificate = require('get-ssl-certificate');

const rubberneckDbReadWrite = (process.env.rubberneck_db_readwrite);
const blockchainDbRead = (process.env.blockchain_db_read);

const cache = {
  lifetime: 3600
};
const cacheAppend = (key, value) => {
  cache[key] = {
    expires: Date.now() + cache.lifetime * 1000,
    value
  };
}
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
    name: 'kusama-internal',
    domains: [
      'kusama-internal.calamari.systems',
      'internal.kusama.systems',
    ],
    jobs: {
      invulnerable: [
        'seabird'
      ],
    },
    tier: 'relaychain',
  },
  {
    name: 'moonriver',
    domains: [
      'kusama-internal.moonriver-testnet.calamari.systems',
      'moonriver.seabird.systems',
    ],
    jobs: {
      invulnerable: [
        'moonriver-testnet'
      ],
    },
    tier: 'parachain',
    relay: 'kusama-internal',
  },
  {
    name: 'calamari',
    domains: [
      'kusama-internal.testnet.calamari.systems',
      'calamari.seabird.systems',
    ],
    jobs: {
      invulnerable: [
        'calamari-testnet'
      ],
    },
    tier: 'parachain',
    relay: 'kusama-internal',
  },
  {
    name: 'acala',
    domains: [
      'acala.seabird.systems',
    ],
    jobs: {
      invulnerable: [
        'acala'
      ],
    },
    tier: 'parachain',
    relay: 'kusama-internal',
  },
  {
    name: 'dolphin',
    domains: [
      'dolphin.seabird.systems',
    ],
    jobs: {
      invulnerable: [
        'dolphin'
      ],
    },
    tier: 'parachain',
    relay: 'kusama-internal',
  },
  {
    name: 'calamari',
    domains: [
      'calamari.moonsea.systems',
    ],
    jobs: {
      invulnerable: [
        'moonsea-calamari'
      ],
    },
    tier: 'parachain',
    relay: 'moonsea',
  },
  {
    name: 'dolphin',
    domains: [
      'rococo.dolphin.engineering',
      'dolphin.engineering',
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

const connectToDatabase = async (databaseName) => {
  if (cache[`db-${databaseName}`] && cache[`db-${databaseName}`].expires < Date.now()) {
    return cache[`db-${databaseName}`].value;
  }
  let connectionString;
  switch (databaseName) {
    case 'infrastructure':
      connectionString = blockchainDbRead;
      break;
    default:
      connectionString = rubberneckDbReadWrite;
  }
  const client = await MongoClient.connect(connectionString);
  const db = await client.db(databaseName);
  cacheAppend(`db-${databaseName}`, db);
  return db;
}

const consoleLink = (node) => {
  switch (node.provider) {
    case 'amazon-ec2':
      return {
        url: `https://console.aws.amazon.com/ec2/v2/home?region=${node.metadata.region}#InstanceDetails:instanceId=${node.metadata.id}`,
        text: `${node.metadata.region}/${node.metadata.id}`,
      };
    case 'hetzner-cloud':
      return {
        url: `https://console.hetzner.cloud/projects/${node.metadata.profile}/servers/${node.metadata.id}/overview`,
        text: `${node.metadata.dc}/${node.metadata.id}`,
      };
    case 'hetzner-robot':
      return {
        url: `https://robot.hetzner.com/server`,
        text: `${node.metadata.dc}/${node.metadata.id}`,
      };
    case 's4y-dedicated':
      return {
        url: `https://my.server4you.net/en/Dedicated/Contract/Index/show?server_name=${node.metadata.id}`,
        text: `${node.metadata.dc}/${node.metadata.id}`,
      };
    case 'shock-dedicated':
      return {
        url: `https://shockhosting.net/portal/clientarea.php?action=productdetails&id=${node.metadata.id}`,
        text: `${node.metadata.dc}/${node.metadata.id}`,
      };
    default:
      return null;
  }
};
const fetchInstances = async () => {
  if (!cache.instances || !cache.instances.length || cache.instances.expires < Date.now()) {
    const db = await connectToDatabase('infrastructure');
    const nodes = await db.collection('node').find().toArray();
    const instances = await Promise.all(nodes.map(async (node) => ({
      provider: node.provider,
      profile: node.metadata.profile,
      fqdn: node.fqdn,
      hostname: node.fqdn.split('.')[0],
      domain: node.fqdn.split('.').slice(1).join('.'),
      ip: node.ip[0],
      launch: (!!node.metadata && !!node.metadata.launch) ? node.metadata.launch : (new Date().toISOString()),
      location: node.location,
      certificate: node.certificate,
      chain: node.chain,
      price: (!!node.metadata && !!node.metadata.price) ? node.metadata.price : { hour: { currency: 'USD', amount: 0 } },
      console: consoleLink(node),
      //metadata: node.metadata,
    })));
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
  const chain = (!!parachain)
    ? `${blockchain.relay}/${blockchain.name}`
    : blockchain.name;
  const [ instances, targets ] = [ await fetchInstances(), await fetchTargets() ];
  const jobs = Object.values(blockchain.jobs).reduce((a, b) => [...a, ...b], []);
  const chainTargets = targets.filter(t => jobs.includes(t.scrapePool));
  const nodes = instances
    .filter(i => i.chain === chain)
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
  const db = await connectToDatabase('rubberneck');
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
  return observations;
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
