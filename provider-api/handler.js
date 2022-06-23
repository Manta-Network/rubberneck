'use strict';

const aws = require('aws-sdk');

const response = {
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Credentials': true,
    'Content-Type': 'application/json',
  },
};

const hostedZones = [
  {
    name: 'dolphin.community',
    id: 'Z04723123RSFKX973KWFU'
  },
  {
    name: 'dolphin.engineering',
    id: 'Z08463631VRW8SQN1AZ34'
  },
  {
    name: 'pelagosmanta.network',
    id: 'Z050068439CHVGZHSWZ4I'
  },
  {
    name: 'dolphin.red',
    id: 'Z0343786EH6Y8Q6853Y4'
  },
  {
    name: 'calamari.systems',
    id: 'Z05193482B5IW6HGQWXBH'
  },
  {
    name: 'manta.systems',
    id: 'Z0172210BDGAFVE6L94R'
  },
  {
    name: 'pelagos.systems',
    id: 'Z05342861ELNV43ZXZBSE'
  },
  {
    name: 'seahorse.systems',
    id: 'Z0296724LRL3VTM5YJGE'
  },
  {
    name: 'subsquid.systems',
    id: 'Z0680932252D7OELWSESC'
  }
];

module.exports.dns = async (event) => {
  const params = {
    StartTime: new Date((new Date()).valueOf() - (1000 * 60 * 60 * 24)),
    EndTime: new Date(),
    MetricDataQueries: hostedZones.map((z) => ({
      Id: z.name.replace('.', '_'),
      MetricStat: {
        Metric: {
          Namespace: 'AWS/Route53',
          MetricName: 'DNSQueries',
          Dimensions: [
            {
              Name: 'HostedZoneId',
              Value: z.id
            }
          ]
        },
        Period: 60 * 30,
        Stat: 'Sum'
      },
      ReturnData: true
    })),
  };
  const cloudWatchMetrics = (await (new aws.CloudWatch()).getMetricData(params).promise()).MetricDataResults;
  const allTheTimestamps = [...new Set(cloudWatchMetrics.reduce((a, b) => [...a, ...b.Timestamps.map((ts) => ts.toISOString())], []))].sort((a, b) => a > b ? 1 : a < b ? -1 : 0);
  const metrics = {
    labels: allTheTimestamps,
    datasets: cloudWatchMetrics.map(cwm => ({
      label: cwm.Id.replace('_', '.'),
      data: allTheTimestamps.map((timestamp) => {
        const index = cwm.Timestamps.findIndex((ts) => ts.toISOString() === timestamp);
        return (index > -1) ? cwm.Values[index] : 0;
      })
    }))
  };
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
