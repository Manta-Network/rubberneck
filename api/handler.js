'use strict';

const MongoClient = require('mongodb').MongoClient;
const fetch = require('node-fetch');
const sslCertificate = require('get-ssl-certificate');

const blockchainDbRead = (process.env.blockchain_db_read || 'mongodb+srv://chainreader:LG9YHNLfYCcpJisW@chaincluster.oulrzox.mongodb.net');

const cache = {
  lifetime: 3600
};
const cacheAppend = (key, value) => {
  cache[key] = {
    expires: Date.now() + cache.lifetime * 1000,
    value
  };
}

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
    case 'health':
    case 'infrastructure':
      connectionString = `${blockchainDbRead.replace('/test', '')}/${databaseName}`;
      break;
    default:
      connectionString = blockchainDbRead;
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
const fetchBlockchains = async () => {
  if (!cache.blockchains || !cache.blockchains.length || cache.blockchains.expires < Date.now()) {
    const db = await connectToDatabase('infrastructure');
    const chains = await db.collection('node').distinct('chain');
    //const chains = await db.collection('node').find({}, { projection: { _id: false, chain: true } }).distinct().toArray();
    const blockchains = (await db.collection('blockchain').find({}, { projection: { _id: false } }).toArray())
      .map((blockchain) => ({
        ...blockchain,
        chain: (!!blockchain.tier) ? `${blockchain.relay}/${blockchain.name}` : blockchain.name,
      }))
      .filter((blockchain) => chains.includes(blockchain.chain))
      .sort((a, b) => (a.chain > b.chain) ? 1 : (a.chain < b.chain) ? -1 : 0)
      .map((blockchain) => ({
        ...blockchain,
        network: ['kusama/calamari'].includes(blockchain.chain)
          ? 'mainnet'
          : (!!blockchain.tier)
            ? `testnet (${blockchain.relay})`
            : `testnet (${blockchain.name})`,
      }));
    cacheAppend('blockchains', blockchains);
  }
  return cache.blockchains.value;
};
const fetchTargets = async () => {
  if (!cache.targets || !cache.targets.length || cache.targets.expires < Date.now()) {
    const response = await fetch(`https://pulse.pelagos.systems/api/v1/targets`);
    const json = await response.json();
    const targets = json.data.activeTargets.map((target) => ({
      ...target,
      fqdn: target.labels.instance.split(':')[0].replace(/(para|relay|calamari|kusama|dolphin|rococo|manta|polkadot)\.metrics\./, '')
    }));
    cacheAppend('targets', targets);
  }
  return cache.targets.value;
};
const fetchChainNodes = async (relaychain, parachain) => {
  const blockchains = await fetchBlockchains();
  const blockchain = (!!parachain)
    ? blockchains.find((b) => b.name === parachain && b.relay === relaychain)
    : blockchains.find((b) => b.name === relaychain);
  const chain = (!!parachain) ? `${blockchain.relay}/${blockchain.name}` : blockchain.name;
  const [ instances, targets ] = [ await fetchInstances(), await fetchTargets() ];
  const nodes = instances
    .filter((instance) => instance.chain === chain)
    .map((instance) => ({
      ...instance,
      roles: invulnerables.includes(instance.hostname) ? ['invulnerable'] : ['full'],
      metrics: {
        node: targets.find((target) => target.fqdn === instance.fqdn && (
            target.discoveredLabels.__metrics_path__ === '/node/metrics'
            ||
            (target.discoveredLabels.__metrics_path__ === '/metrics' && target.discoveredLabels.__address__ === target.fqdn)
          )),
        ...(!!blockchain.tier) && {
          para: targets.find((target) => target.fqdn === instance.fqdn && (
            target.discoveredLabels.__metrics_path__ === '/para/metrics'
            ||
            target.discoveredLabels.__address__ === `para.metrics.${target.fqdn}`
            ||
            (new RegExp(`/${blockchain.name}.*\\.${target.fqdn}/`)).test(target.fqdn)
          ))
        },
        ...(!!blockchain.tier) && {
          relay: targets.find((target) => target.fqdn === instance.fqdn && (
            target.discoveredLabels.__metrics_path__ === '/relay/metrics'
            ||
            target.discoveredLabels.__address__ === `relay.metrics.${target.fqdn}`
            || 
            (new RegExp(`/${blockchain.relay}.*\\.${target.fqdn}/`)).test(target.fqdn)
          ))
        },
      }
    }));
  return nodes;
};
const fetchAllNodes = async () => {
  const [ blockchains, instances, targets ] = [ await fetchBlockchains(), await fetchInstances(), await fetchTargets() ];
  const nodes = instances
    .map((instance) => {
      const blockchain = blockchains.find((b) => b.domains.includes(instance.domain));
      return {
        ...instance,
        roles: invulnerables.includes(instance.hostname)
          ? ['invulnerable']
          : (!!blockchain)
            ? ['full']
            : (!!instance.domain.split('.').includes('telemetry'))
              ? ['telemetry']
              : [],
        metrics: {
          node: targets.find((target) => (
            (target.discoveredLabels.__metrics_path__ === '/metrics' && target.discoveredLabels.__address__ === target.fqdn)
            ||
            (target.discoveredLabels.__metrics_path__ === '/node/metrics')
          )),
          ...((!!blockchain) && (!!blockchain.tier)) && {
            para: targets.find((target) => target.fqdn === instance.fqdn && (
              target.discoveredLabels.__metrics_path__ === '/para/metrics'
              ||
              target.discoveredLabels.__address__ === `para.metrics.${target.fqdn}`
              ||
              (new RegExp(`/${blockchain.name}.*\\.${target.fqdn}/`)).test(target.fqdn)
            ))
          },
          ...((!!blockchain) && (!!blockchain.tier)) && {
            relay: targets.find((target) => target.fqdn === instance.fqdn && (
              target.discoveredLabels.__metrics_path__ === '/relay/metrics'
              ||
              target.discoveredLabels.__address__ === `relay.metrics.${target.fqdn}`
              || 
              (new RegExp(`/${blockchain.relay}.*\\.${target.fqdn}/`)).test(target.fqdn)
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
  const [ blockchains, instance, targets ] = [
    await fetchBlockchains(),
    (await fetchInstances()).find((instance) => instance.fqdn === fqdn),
    (await fetchTargets()).filter((target) => target.fqdn === fqdn),
  ];
  //const wsResponses = await fetchWebsocketResponses(instance.fqdn, [{ method: 'system_localPeerId' }, { method: 'system_health' }]);
  const blockchain = blockchains.find((b) => b.domains.includes(instance.domain));
  const metrics = {
    ...targets.some((target) => target.discoveredLabels.__address__ === target.fqdn) && {
      node: targets.find((target) => target.discoveredLabels.__address__ === target.fqdn)
    },
    ...targets.some((target) => target.discoveredLabels.__address__ === `para.metrics.${target.fqdn}`) && {
      para: targets.find((target) => target.discoveredLabels.__address__ === `para.metrics.${target.fqdn}`)
    },
    ...targets.some((target) => target.discoveredLabels.__address__ === `relay.metrics.${target.fqdn}`) && {
      relay: targets.find((target) => target.discoveredLabels.__address__ === `relay.metrics.${target.fqdn}`)
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
  const db = await connectToDatabase('health');
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
  const blockchains = await fetchBlockchains();
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
