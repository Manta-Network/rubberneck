import { useParams } from 'react-router-dom';
import { Fragment, useEffect, useState } from 'react';
import Col from 'react-bootstrap/Col';
import Row from 'react-bootstrap/Row';
import ProgressBar from 'react-bootstrap/ProgressBar';
import Spinner from 'react-bootstrap/Spinner';
import Table from 'react-bootstrap/Table';
import NodeRow from './NodeRow';
import apiBaseUrl from './apiBaseUrl';
import getWsConnections from './getWsConnections';

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
    const interval = setInterval(() => {
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
    }, (3 * 1000));
    return () => clearInterval(interval);
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
  useEffect(() => {
    const interval = setInterval(() => {
      if (!!nodes && !!nodes.length) {
        (
          async () => {
            setWsConnections((await Promise.all(nodes.map((n) => getWsConnections(n.fqdn)))).reduce((a, c) => ({ active: (a.active + c.active), max: (a.max + c.max) }), { active: 0, max: 0 }));
          }
        )()
      }
    }, (1 * 1000));
    return () => clearInterval(interval);
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
        <Col xs={6} style={{textAlign: 'center'}}>
          {
            (!!wsConnections.active)
            ? (
                <span className="text-muted">
                  infrastructure utilisation: <strong className="text-dark">
                    {
                      new Intl.NumberFormat('default', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 2 }).format((wsConnections.active / wsConnections.max))
                    }
                  </strong><br />
                  active connections: <strong className="text-dark">{Intl.NumberFormat('default').format(wsConnections.active)}</strong>, current capacity: <strong className="text-dark">{Intl.NumberFormat('default').format(wsConnections.max)}</strong>
                </span>
              )
            : (
                <Spinner style={{...props.style}} animation="grow" size="sm" className="text-secondary">
                  <span className="visually-hidden">websocket active connection count lookup in progress</span>
                </Spinner>
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
                  <NodeRow key={nI} node={node} />
                ))
          }
        </tbody>
      </Table>
    </Fragment>
  );
}

export default Chain;
