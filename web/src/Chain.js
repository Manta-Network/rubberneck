import { Link, useParams } from 'react-router-dom';
import { Fragment, useEffect, useState } from 'react';
import Col from 'react-bootstrap/Col';
import Row from 'react-bootstrap/Row';
import Spinner from 'react-bootstrap/Spinner';
import Table from 'react-bootstrap/Table';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faAws } from '@fortawesome/free-brands-svg-icons'
import { faH } from '@fortawesome/free-solid-svg-icons';
import NodeDiskUsage from './NodeDiskUsage';
import NodeOs from './NodeOs';
import NodeConnections from './NodeConnections';
import NodeHealth from './NodeHealth';
import RunningCost from './RunningCost';
import badge from './badge';
import { ReactComponent as ShockLogo } from './shock.svg';
import { ReactComponent as S4yLogo } from './s4y.svg';
import ProgressBar from 'react-bootstrap/ProgressBar';
import apiBaseUrl from './apiBaseUrl';
import getWsConnections from './getWsConnections';

const consoleLink = (node) => {
  switch (node.provider) {
    case 'amazon-ec2':
      return (
        <a href={node.console.url}>
          <span style={{marginRight: '0.3em', color: 'rgb(255, 153, 0)', padding: '0 0.2em'}}>
            <FontAwesomeIcon icon={faAws} />
          </span>
          {node.console.text.toLowerCase()}
        </a>
      );
    case 'hetzner-cloud':
      return (
        <a href={node.console.url}>
          <span style={{marginRight: '0.3em', backgroundColor: 'red', color: 'white', padding: '0 0.2em'}}>
            <FontAwesomeIcon icon={faH} />
          </span>
          {node.console.text.toLowerCase()}
        </a>
      );
    case 'hetzner-robot':
      return (
        <a href={node.console.url}>
          <span style={{marginRight: '0.3em', backgroundColor: 'red', color: 'white', padding: '0 0.2em'}}>
            <FontAwesomeIcon icon={faH} />
          </span>
          {node.console.text.toLowerCase()}
        </a>
      );
    case 's4y-dedicated':
      return (
        <a href={node.console.url}>
          <S4yLogo style={{width: '20px', height: '20px', marginRight: '5px'}} />
          {node.console.text.toLowerCase()}
        </a>
      );
    case 'shock-dedicated':
      return (
        <a href={node.console.url}>
          <ShockLogo style={{width: '20px', height: '20px', marginRight: '5px'}} />
          {node.console.text.toLowerCase()}
        </a>
      );
    default:
      return null;
  }
};

const threshold = {
  danger: 0.75,
  warning: 0.5,
};

function Chain(props) {
  const { relaychain, parachain } = useParams();
  const [wsConnections, setWsConnections] = useState({ active: 0, max: 100 });
  const [cost, setCost] = useState(undefined);
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const apiUrl = (parachain !== undefined)
    ? `${apiBaseUrl}/nodes/${relaychain}/${parachain}`
    : `${apiBaseUrl}/nodes/${relaychain}`;
  useEffect(() => {
    setLoading(true);
    fetch(apiUrl)
      .then(response => response.json())
      .then((container) => {
        if (!!container.error) {
          console.error(container.error);
        } else {
          setNodes(container.nodes.filter((n) => (n.hostname !== 'ws')).sort((a, b) => (a.fqdn > b.fqdn) ? 1 : (a.fqdn < b.fqdn) ? -1 : 0));
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
      (
        async () => {
          setWsConnections((await Promise.all(nodes.map((n) => getWsConnections(n.fqdn)))).reduce((a, c) => ({ active: (a.active + c.active), max: (a.max + c.max) }), { active: 0, max: 0 }));
        }
      )()
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
                    {parachain.replace('-testnet', 'ᵗ').replace('-internal', 'ᶤ')} <sup><em className="text-muted">{relaychain.replace('-testnet', 'ᵗ').replace('-internal', 'ᶤ')}</em></sup>
                  </h2>
                )
              : (
                  <h2>
                    {relaychain.replace('-testnet', 'ᵗ').replace('-internal', 'ᶤ')}
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
      <Row>
        <Col>
          {
            (!!wsConnections.active)
            ? (
                <ProgressBar
                  striped
                  now={((wsConnections.active / wsConnections.max) * 100)}
                  title={`connections: ${wsConnections.active} active / ${wsConnections.max} max`}
                  variant={
                    ((wsConnections.active / wsConnections.max) > threshold.danger)
                      ? 'danger'
                      : ((wsConnections.active / wsConnections.max) > threshold.warning)
                        ? 'warning'
                        : 'success'
                  }
                />
              )
            : (
                <Spinner style={{...props.style}} animation="grow" size="sm" className="text-secondary">
                  <span className="visually-hidden">websocket active connection count lookup in progress</span>
                </Spinner>
              )
          }
        </Col>
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
                      ['fqdn', 'metrics', 'os', 'disk', 'clients', 'roles', 'meta', 'console', 'cost'].map((header, hI) => (
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
                  <tr key={nI}>
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
                      <NodeHealth fqdn={node.fqdn} />
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
                      <NodeOs fqdn={node.fqdn} />
                    </td>
                    <td>
                      <NodeDiskUsage fqdn={node.fqdn} />
                    </td>
                    <td>
                      <NodeConnections fqdn={node.fqdn} />
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
                      {consoleLink(node)}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <RunningCost node={node} />
                    </td>
                  </tr>
                ))
          }
        </tbody>
      </Table>
    </Fragment>
  );
}

export default Chain;
