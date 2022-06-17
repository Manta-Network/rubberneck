import {
  Link,
  useParams,
} from 'react-router-dom';
import { Fragment, useEffect, useState } from 'react';
import Table from 'react-bootstrap/Table';
import Spinner from 'react-bootstrap/Spinner';
import Row from 'react-bootstrap/Row';
import ChainMetrics from './ChainMetrics';

const badge = {
  invulnerable: 'shield-lock-fill',
  validator: 'shield-shaded',
  collator: 'shield-shaded',
  full: 'book',
  rpc: 'cpu',
  archive: 'archive',
  node: {
    active: 'cpu-fill',
    inactive: 'cpu',
  },
  para: {
    active: 'hdd-network-fill',
    inactive: 'hdd-network',
  },
  relay: {
    active: 'diagram-2-fill',
    inactive: 'diagram-2',
  },
};

function Chain(props) {
  const { relaychain, parachain } = useParams();
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    fetch(`https://5eklk8knsd.execute-api.eu-central-1.amazonaws.com/prod/nodes/${relaychain}/${parachain}`)
      .then(response => response.json())
      .then((container) => {
        if (!!container.error) {
          console.error(container.error);
        } else {
          setNodes(container.nodes);
        }
        setLoading(false);
      })
      .catch((error) => {
        console.error(error);
        setLoading(false);
      });
  }, [relaychain, parachain]);
  return (
    <Fragment>
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
      <Table striped>
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
                      ['fqdn', 'metrics', 'roles', 'meta'].map((header, hI) => (
                        <th key={hI}>
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
                  </tr>
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
