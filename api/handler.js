'use strict';

const fetch = require('node-fetch');
const sslCertificate = require('get-ssl-certificate');
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

module.exports.dns = async (event) => {
  const params = {
    StartTime: new Date(),
    EndTime: new Date((new Date()).valueOf() + (1000 * 60 * 60 * 24 * 2)),
    MetricDataQueries: [
      {
        Id: 'dolphin_community',
        MetricStat: {
          Metric: {
            Namespace: 'AWS/Route53',
            MetricName: 'DNSQueries',
            Dimensions: [
              {
                Name: 'HostedZoneId',
                Value: 'Z04723123RSFKX973KWFU'
              }
            ]
          },
          Period: 60,
          Stat: 'Sum'
        },
        ReturnData: true
      },
      {
        Id: 'dolphin_engineering',
        MetricStat: {
          Metric: {
            Namespace: 'AWS/Route53',
            MetricName: 'DNSQueries',
            Dimensions: [
              {
                Name: 'HostedZoneId',
                Value: 'Z08463631VRW8SQN1AZ34'
              }
            ]
          },
          Period: 60,
          Stat: 'Sum'
        },
        ReturnData: true
      },
      {
        Id: 'pelagosmanta_network',
        MetricStat: {
          Metric: {
            Namespace: 'AWS/Route53',
            MetricName: 'DNSQueries',
            Dimensions: [
              {
                Name: 'HostedZoneId',
                Value: 'Z050068439CHVGZHSWZ4I'
              }
            ]
          },
          Period: 60,
          Stat: 'Sum'
        },
        ReturnData: true
      },
      {
        Id: 'dolphin_red',
        MetricStat: {
          Metric: {
            Namespace: 'AWS/Route53',
            MetricName: 'DNSQueries',
            Dimensions: [
              {
                Name: 'HostedZoneId',
                Value: 'Z0343786EH6Y8Q6853Y4'
              }
            ]
          },
          Period: 60,
          Stat: 'Sum'
        },
        ReturnData: true
      },
      {
        Id: 'calamari_systems',
        MetricStat: {
          Metric: {
            Namespace: 'AWS/Route53',
            MetricName: 'DNSQueries',
            Dimensions: [
              {
                Name: 'HostedZoneId',
                Value: 'Z05193482B5IW6HGQWXBH'
              }
            ]
          },
          Period: 60,
          Stat: 'Sum'
        },
        ReturnData: true
      },
      {
        Id: 'manta_systems',
        MetricStat: {
          Metric: {
            Namespace: 'AWS/Route53',
            MetricName: 'DNSQueries',
            Dimensions: [
              {
                Name: 'HostedZoneId',
                Value: 'Z0172210BDGAFVE6L94R'
              }
            ]
          },
          Period: 60,
          Stat: 'Sum'
        },
        ReturnData: true
      },
      {
        Id: 'pelagos_systems',
        MetricStat: {
          Metric: {
            Namespace: 'AWS/Route53',
            MetricName: 'DNSQueries',
            Dimensions: [
              {
                Name: 'HostedZoneId',
                Value: 'Z05342861ELNV43ZXZBSE'
              }
            ]
          },
          Period: 60,
          Stat: 'Sum'
        },
        ReturnData: true
      },
      {
        Id: 'seahorse_systems',
        MetricStat: {
          Metric: {
            Namespace: 'AWS/Route53',
            MetricName: 'DNSQueries',
            Dimensions: [
              {
                Name: 'HostedZoneId',
                Value: 'Z0296724LRL3VTM5YJGE'
              }
            ]
          },
          Period: 60,
          Stat: 'Sum'
        },
        ReturnData: true
      },
      {
        Id: 'subsquid_systems',
        MetricStat: {
          Metric: {
            Namespace: 'AWS/Route53',
            MetricName: 'DNSQueries',
            Dimensions: [
              {
                Name: 'HostedZoneId',
                Value: 'Z0680932252D7OELWSESC'
              }
            ]
          },
          Period: 60,
          Stat: 'Sum'
        },
        ReturnData: true
      }
    ]
  };
  const metrics = await (new aws.CloudWatch()).getMetricData(params).promise();
  let error;
  const body = {
    metrics,
    error,
  };
  return {
    ...response,
    statusCode: (!!error) ? 500 : 200,
    body: JSON.stringify(body, null, 2),
  };
}
