'use strict';

const MongoClient = require('mongodb').MongoClient;
const fetch = require('node-fetch');

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
const range = (start, end) => Array.from({length: ((end + 1) - start)}, (v, k) => k + start);

const response = {
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Credentials': true,
    'Content-Type': 'application/json',
  },
};

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
      .sort((a, b) => (a.chain > b.chain) ? 1 : (a.chain < b.chain) ? -1 : 0);
    cacheAppend('blockchains', blockchains);
  }
  return cache.blockchains.value;
};
const nodeHealth = async (fqdn, from, to) => {
  const db = await connectToDatabase('health');
  const common = {
    fqdn,
    observed: {
      $gte: from,
      $lte: to,
    },
  };
  const [
    total,
    healthy,
  ] = await Promise.all([
    db.collection('observation').countDocuments(common),
    db.collection('observation').countDocuments(
      {
        ...common,
        "node.id": {
          $exists: true,
        },
        "node.peers": {
          $exists: true,
        },
      }
    ),
  ]);
  return { from, to, total, healthy };
};
const chainHealth = async (chain, from, to) => {
  const db = await connectToDatabase('health');
  const observations = await db.collection('observation').aggregate([
    {
      $match: {
        'node.chain': chain,
        observed: {
          $gte: from,
          $lte: to,
        },
      },
    },
    {
      $replaceRoot: {
        newRoot: {
          $mergeObjects: [
            '$node',
            '$$ROOT'
          ],
        },
      },
    },
    {
      $project: {
        _id: false,
        observed: true,
        fqdn: true,
        id: true,
        peers: true,
      }
    }
  ]).toArray();
  return observations;
};

module.exports.node = async (event) => {
  const { fqdn, from, to } = {
    ...event.pathParameters,
    from: new Date(event.pathParameters.from),
    to: new Date(event.pathParameters.to),
  };
  const summary = await nodeHealth(fqdn, from, to);
  let error;
  const body = {
    summary,
    error,
  };
  return {
    ...response,
    statusCode: (!!error) ? 500 : 200,
    body: JSON.stringify(body, null, 2),
  };
};


module.exports.chain = async (event) => {
  const { relaychain, parachain, from, to } = {
    ...event.pathParameters,
    from: new Date(event.pathParameters.from),
    to: new Date(event.pathParameters.to),
  };
  const chain = (!!parachain) ? `${relaychain}/${parachain}` : relaychain;
  const oneMinute = (60 * 1000);
  const oneHour = (60 * oneMinute);
  const oneDay = (24 * oneHour);
  const chunkConfigs = [
    
    // 5 minutes ~ 1 hour: 5 minute spans
    {
      min: (5 * oneMinute),
      max: oneHour,
      span: (5 * oneMinute),
    },
    
    // 60 minutes ~ 2 hours: 10 minute spans
    {
      min: oneHour,
      max: (2 * oneHour),
      span: (10 * oneMinute),
    },
    
    // 2 hours ~ 24 hours: 2 hour spans
    {
      min: (2 * oneHour),
      max: oneDay,
      span: (2 * oneHour),
    },
    
    // 24 hours ~ 3 days: 2 hour spans
    {
      min: oneDay,
      max: (3 * oneDay),
      span: (2 * oneHour),
    },
    
    // 3 days ~ 7 days: 6 hour spans
    {
      min: (3 * oneDay),
      max: (7 * oneDay),
      span: (6 * oneHour),
    },
    
    // 7 days ~ 30 days: 48 hour spans
    {
      min: (7 * oneDay),
      max: (30 * oneDay),
      span: (2 * oneDay),
    },
  ];
  const timespan = (to.getTime() - from.getTime());
  const chunkConfig = chunkConfigs.find((cc) => ((timespan >= cc.min) && (timespan <= cc.max)));
  const observations = await chainHealth(chain, from, to);

  let error;
  const body = {
    summary: {
      from,
      to,
      total: observations.length,
      healthy: observations.filter((o) => (!!o.id && !!o.peers)).length,
    },
    chunks: range(0, (timespan / chunkConfig.span)).map((i) => {
      const fromAsEpoch = (from.getTime() + (i * chunkConfig.span));
      const [ chunkFrom, chunkTo ] = [ new Date(fromAsEpoch), new Date(fromAsEpoch + chunkConfig.span - 1) ];
      const chunkObservations = observations.filter((o) => ((o.observed >= chunkFrom) && (o.observed <= chunkTo)));
      return {
        from: chunkFrom,
        to: chunkTo,
        total: chunkObservations.length,
        healthy: chunkObservations.filter((o) => (!!o.id && !!o.peers)).length,
        observations: chunkObservations,
      };
    }).filter((chunk) => !!chunk.total),
    error,
  };
  return {
    ...response,
    statusCode: (!!error) ? 500 : 200,
    body: JSON.stringify(body, null, 2),
  };
};
