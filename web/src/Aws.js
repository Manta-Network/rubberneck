import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Spinner from 'react-bootstrap/Spinner';
import Table from 'react-bootstrap/Table';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faAws } from '@fortawesome/free-brands-svg-icons';
import badge from './badge';

const endpoints = {
  ops: 'https://7p1eol9lz4.execute-api.us-east-1.amazonaws.com/prod/instances',
  dev: 'https://mab48pe004.execute-api.us-east-1.amazonaws.com/prod/instances',
  service: 'https://l7ff90u0lf.execute-api.us-east-1.amazonaws.com/prod/instances',
  prod: 'https://hzhmt0krm0.execute-api.us-east-1.amazonaws.com/prod/instances'
};

const getUtility = (domain) => {
  switch (domain) {
    case 'baikal.manta.systems':
      return 'baikal';
    case 'baikal.testnet.calamari.systems':
      return 'baikal/calamari-testnet';
    case 'baikal.testnet.dolphin.training':
      return 'baikal/dolphin';
    case 'calamari.systems':
      return 'kusama/calamari';
    case 'moonbase-relay.testnet.calamari.systems':
      return 'moonbase/calamari';
    case 'rococo.dolphin.engineering':
      return 'rococo/dolphin';
    case 'telemetry.manta.systems':
      return 'mainnet/telemetry';
    case 'telemetry.pelagos.systems':
      return 'testnet/telemetry';
    default:
      return 'infra';
  }
}

function Aws(props) {
  const [loading, setLoading] = useState(undefined);
  const [instances, setInstances] = useState([]);
  useEffect(() => {
    if (loading === undefined) {
      setLoading(true);
      Object.keys(endpoints).forEach((profile) => {
        fetch(endpoints[profile])
          .then((r) => r.json())
          .then((container) => {
            setInstances(instances => {
              return (instances.some(i => i.profile === profile))
                ? instances
                : [
                    ...instances,
                    ...container.instances.map((instance, iI) => ({
                      ...instance,
                      profile,
                      utility: getUtility(instance.domain)
                    })),
                  ].sort((a, b) => (`${a.domain}-${a.hostname}` < `${b.domain}-${b.hostname}` ? -1 : `${a.domain}-${a.hostname}` > `${b.domain}-${b.hostname}` ? 1 : 0))
            });
            setLoading(false);
          })
          .catch(console.error);
      });
    }
  }, [loading]);
  return (
    <Fragment>
    <Table>
      <thead>
        {
          (loading || loading === undefined)
            ? (
                <tr>
                  <th>
                    <em>
                      <span className="text-muted">instances lookup in progress...</span>
                    </em>
                  </th>
                </tr>
              )
            : (
                <tr>
                  {
                    ['utility', 'fqdn', 'metrics', 'roles', 'meta', 'console'].map((header, hI) => (
                      <th key={hI} style={(header === 'cost') ? { textAlign: 'right' } : {}}>
                        {header}
                      </th>
                    ))
                  }
                </tr>
              )
        }
      </thead>
      <tbody>
        {
          (loading || loading === undefined)
            ? (
                <tr>
                  <td>
                    <Spinner animation="border" variant="secondary" size="sm">
                      <span className="visually-hidden">instances lookup in progress...</span>
                    </Spinner>
                  </td>
                </tr>
              )
            : instances.map((node, nI) => (
                <Fragment key={nI}>
                  <tr>
                    <td>
                      <Link to={`/chain/${node.utility}`} style={{textDecoration: 'none'}}>
                        <strong>
                          {
                            (node.utility.includes('/'))
                              ? (
                                  <Fragment><strong>{node.utility.split('/')[1]}</strong> <sup><em className="text-muted">{node.utility.split('/')[0]}</em></sup></Fragment>
                                )
                              : (node.utility)
                          }
                        </strong>
                      </Link>
                    </td>
                    <td>
                      <Link to={`/node/${node.fqdn}`} style={{textDecoration: 'none'}}>
                        <strong>
                          {node.hostname}
                        </strong>
                        <span className="text-muted">
                          .{node.domain}
                        </span>
                      </Link>
                    </td>
                    <td>
                      {
                        (!!node.metrics)
                          ? Object.entries(node.metrics).map(([name, target], tI) => {
                              const secondsSinceLastScrape = ((Date.now() - (new Date(target.lastScrape))) / 1000);
                              const scrapeInterval = parseInt(target.scrapeInterval.replace('s', ''));
                              const state = (secondsSinceLastScrape < scrapeInterval)
                                ? 'active'
                                : 'inactive';
                              const clue = (secondsSinceLastScrape < scrapeInterval)
                                ? 'text-success'
                                : (secondsSinceLastScrape < (scrapeInterval * 2))
                                  ? 'text-warning'
                                  : 'text-danger';
                              return (
                                <i key={tI} title={`${secondsSinceLastScrape} seconds since last ${name} metrics scrape`} className={`bi bi-${badge[name][state]} ${clue}`} style={{marginRight: '0.5em'}} />
                              );
                            })
                          : (
                              <i title={`metrics unavailable`} className={`bi bi-exclamation text-danger`} />
                            )
                      }
                    </td>
                    <td>
                      {
                        (!!node.roles && !!node.roles.length)
                          ? node.roles.map((role, rI) => (
                              <i key={rI} title={role} className={`bi bi-${badge[role]}`} />
                            ))
                          : null
                      }
                    </td>
                    <td>
                      {
                        (!!node.location && !!node.location.country && !!node.location.country.flag)
                          ? (
                              <span
                                title={`${node.region}: ${node.location.city.name}, ${node.location.country.name}`}>
                                {node.location.country.flag}
                              </span>
                            )
                          : <i className={`bi bi-geo`} title={(!!node.location && !!node.location.country)? node.location.country : node.region} />
                      }
                    </td>
                    <td>
                      <a href={`https://console.aws.amazon.com/ec2/v2/home?region=${node.region}#InstanceDetails:instanceId=${node.id}`}>
                        <span style={{marginRight: '0.3em', color: 'rgb(255, 153, 0)', padding: '0 0.2em'}}>
                          <FontAwesomeIcon icon={faAws} />
                        </span>
                        {node.profile}/{node.region}/{node.id}
                      </a>
                    </td>
                  </tr>
                </Fragment>
              ))
        }
      </tbody>
    </Table>
    <pre>
      {JSON.stringify(instances, null, 2)}
    </pre>
    </Fragment>
  );
}

export default Aws;
