import {
  Link,
  useParams,
} from 'react-router-dom';
import { Fragment, useEffect, useState } from 'react';
import Col from 'react-bootstrap/Col';
import Row from 'react-bootstrap/Row';
import Spinner from 'react-bootstrap/Spinner';
import Table from 'react-bootstrap/Table';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faAws } from '@fortawesome/free-brands-svg-icons'
import { faH } from '@fortawesome/free-solid-svg-icons';
import ChainHead from './ChainHead';
import ChainMetrics from './ChainMetrics';
import NodeHealth from './NodeHealth';
import NodeObservations from './NodeObservations';
import RunningCost from './RunningCost';
import badge from './badge';
import { ReactComponent as ShockLogo } from './shock.svg';

function Chain(props) {
  const { relaychain, parachain } = useParams();
  const [cost, setCost] = useState(undefined);
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const apiUrl = (parachain !== undefined)
    ? `https://5eklk8knsd.execute-api.eu-central-1.amazonaws.com/prod/nodes/${relaychain}/${parachain}`
    : `https://5eklk8knsd.execute-api.eu-central-1.amazonaws.com/prod/nodes/${relaychain}`;
  useEffect(() => {
    setLoading(true);
    fetch(apiUrl)
      .then(response => response.json())
      .then((container) => {
        if (!!container.error) {
          console.error(container.error);
        } else {
          setNodes(container.nodes.sort((a, b) => (a.fqdn > b.fqdn) ? 1 : (a.fqdn < b.fqdn) ? -1 : 0));
        }
        setLoading(false);
      })
      .catch((error) => {
        console.error(error);
        setLoading(false);
      });
  }, [relaychain, parachain, apiUrl]);
  useEffect(() => {
    if (!!nodes && !!nodes.length) {
      setCost(nodes.reduce((accumulator, node) => {
        const { currency, amount } = node.price.hour;
        return {
          ...accumulator,
          [currency]: (!!accumulator[currency]) ? accumulator[currency] + Number(amount) : Number(amount)
        };
      }, {}));
    }
  }, [nodes]);
  return (
    <Fragment>
      <Row>
        <Col>
          {
            !!parachain
              ? (
                  <h2>
                    {parachain} <sup><em className="text-muted">{relaychain}</em></sup>
                  </h2>
                )
              : (
                  <h2>
                    {relaychain}
                  </h2>
                )
          }
        </Col>
        {
          (!!cost)
            ? (
                <Col style={{textAlign: 'right'}}>
                  daily:
                  {
                    Object.keys(cost).sort().map((currency, cI) => (
                      <span key={cI} style={{marginLeft: '0.5em'}}>
                        {
                          (cI > 0)
                            ? (
                                <span style={{marginRight: '0.5em'}}>+</span>
                              )
                            : null 
                        }
                        {new Intl.NumberFormat('en-US', { style: 'currency', minimumFractionDigits: 0, currency: currency }).format(cost[currency] * 24)}
                      </span>
                    ))
                  }<br />
                  monthly:
                  {
                    Object.keys(cost).sort().map((currency, cI) => (
                      <span key={cI} style={{marginLeft: '0.5em'}}>
                        {
                          (cI > 0)
                            ? (
                                <span style={{marginRight: '0.5em'}}>+</span>
                              )
                            : null 
                        }
                        {new Intl.NumberFormat('en-US', { style: 'currency', minimumFractionDigits: 0, currency: currency }).format(cost[currency] * 24 * 30)}
                      </span>
                    ))
                  }
                </Col>
              )
            : null
        }
      </Row>
      
      <Table>
        <thead>
          {
            (loading)
              ? (
                  <tr>
                    <th>
                      <em>
                        {
                          !!parachain
                            ? (
                                <span className="text-muted">{parachain} <sup>{relaychain}</sup> nodes lookup in progress...</span>
                              )
                            : (
                                <span className="text-muted">{relaychain} nodes lookup in progress...</span>
                              )
                        }
                      </em>
                    </th>
                  </tr>
                )
              : (
                  <tr>
                    {
                      ['fqdn', 'metrics', 'roles', 'meta', 'console', 'cost'].map((header, hI) => (
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
            (loading)
              ? (
                  <tr>
                    <td>
                      <Spinner animation="border" variant="secondary" size="sm">
                        {
                          !!parachain
                            ? (
                                <span className="visually-hidden">{parachain} <sup>{relaychain}</sup> nodes lookup in progress...</span>
                              )
                            : (
                                <span className="visually-hidden">{relaychain} nodes lookup in progress...</span>
                              )
                        }
                      </Spinner>
                    </td>
                  </tr>
                )
              : nodes.map((node, nI) => (
                  <Fragment key={nI}>
                    <tr>
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
                        <ChainHead url={`wss://${node.fqdn}`} />
                        <NodeHealth fqdn={node.fqdn} style={{marginLeft: '0.5em'}} />
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
                                  <i key={tI} title={`${secondsSinceLastScrape} seconds since last ${name} metrics scrape`} className={`bi bi-${badge[name][state]} ${clue}`} style={{marginLeft: '0.5em'}} />
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
                        {
                          (node.provider === 'hetzner-cloud')
                            ? (
                                <a href={`https://console.hetzner.cloud/projects/${node.project}/servers/${node.id}/overview`}>
                                  <span style={{marginRight: '0.3em', backgroundColor: 'red', color: 'white', padding: '0 0.2em'}}>
                                    <FontAwesomeIcon icon={faH} />
                                  </span>
                                  {node.profile}/{node.location.az}/{node.fqdn}
                                </a>
                              )
                            : (node.provider === 'hetzner-robot')
                              ? (
                                  <a href={`https://console.hetzner.cloud/projects/${node.project}/servers/${node.id}/overview`}>
                                    <span style={{marginRight: '0.3em', backgroundColor: 'red', color: 'white', padding: '0 0.2em'}}>
                                      <FontAwesomeIcon icon={faH} />
                                    </span>
                                    {node.profile}/{node.location.az}/{node.fqdn}
                                  </a>
                                )
                              : (node.provider === 'shock-dedicated')
                                ? (
                                    <a href={`https://shockhosting.net/portal/clientarea.php?action=productdetails&id=${node.id}`}>
                                      <ShockLogo style={{width: '20px', height: '20px', marginRight: '5px'}} />
                                      {node.location.az}/{node.fqdn}
                                    </a>
                                  )
                                : (
                                    <a href={`https://console.aws.amazon.com/ec2/v2/home?region=${node.region}#InstanceDetails:instanceId=${node.id}`}>
                                      <span style={{marginRight: '0.3em', color: 'rgb(255, 153, 0)', padding: '0 0.2em'}}>
                                        <FontAwesomeIcon icon={faAws} />
                                      </span>
                                      {node.profile}/{node.region}/{node.id}
                                    </a>
                                  )
                        }
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <RunningCost node={node} />
                      </td>
                    </tr>
                    <tr>
                      <td style={{ textAlign: 'right' }} colSpan={6}>
                        <NodeObservations fqdn={node.fqdn}/>
                      </td>
                    </tr>
                  </Fragment>
                ))
          }
        </tbody>
      </Table>
      <Row>
        <ChainMetrics blockchain={!!parachain ? `${relaychain}/${parachain}` : relaychain} />
      </Row>
    </Fragment>
  );
}

export default Chain;
