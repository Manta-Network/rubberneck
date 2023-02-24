import { Link, useParams } from 'react-router-dom';
import { Fragment, useEffect, useState } from 'react';
import Badge from 'react-bootstrap/Badge';
import Card from 'react-bootstrap/Card';
import Col from 'react-bootstrap/Col';
import Row from 'react-bootstrap/Row';
import Spinner from 'react-bootstrap/Spinner';
import Tab from 'react-bootstrap/Tab';
import Tabs from 'react-bootstrap/Tabs';
import Table from 'react-bootstrap/Table';
import { dateDiff } from './utils';
import apiBaseUrl from './apiBaseUrl';
import {
  Chart as ChartJS,
  CategoryScale,
  registerables
} from 'chart.js';
import { Chart } from 'react-chartjs-2';
ChartJS.register(...registerables);

/* eslint-disable no-template-curly-in-string */
const metrics = {
  'block height (best)': {
    color: {
      background: 'rgb(158, 193, 249, .5)',
      border: 'rgb(158, 193, 249)'
    },
    exporter: 'substrate',
    query: 'substrate_block_height{instance="${instance}",status="best"}'
  },
  'txpool block transactions pruned': {
    color: {
      background: 'rgb(158, 193, 249, .5)',
      border: 'rgb(158, 193, 249)'
    },
    exporter: 'substrate',
    query: 'substrate_sub_txpool_block_transactions_pruned{instance="${instance}"}'
  },
  'txpool block transactions submitted': {
    color: {
      background: 'rgb(158, 193, 249, .5)',
      border: 'rgb(158, 193, 249)'
    },
    exporter: 'substrate',
    query: 'substrate_sub_txpool_submitted_transactions{instance="${instance}"}'
  },
  'txpool block transactions resubmitted': {
    color: {
      background: 'rgb(158, 193, 249, .5)',
      border: 'rgb(158, 193, 249)'
    },
    exporter: 'substrate',
    query: 'substrate_sub_txpool_block_transactions_resubmitted{instance="${instance}"}'
  },
  'txpool validations finished': {
    color: {
      background: 'rgb(158, 193, 249, .5)',
      border: 'rgb(158, 193, 249)'
    },
    exporter: 'substrate',
    query: 'substrate_sub_txpool_validations_finished{instance="${instance}"}'
  },
  'txpool validations invalid': {
    color: {
      background: 'rgb(204, 0, 0, .5)',
      border: 'rgb(204, 0, 0)'
    },
    exporter: 'substrate',
    query: 'substrate_sub_txpool_validations_invalid{instance="${instance}"}'
  },
  'txpool validations scheduled': {
    color: {
      background: 'rgb(158, 193, 249, .5)',
      border: 'rgb(158, 193, 249)'
    },
    exporter: 'substrate',
    query: 'substrate_sub_txpool_validations_scheduled{instance="${instance}"}'
  },
  'transactions propagated': {
    color: {
      background: 'rgb(158, 193, 249, .5)',
      border: 'rgb(158, 193, 249)'
    },
    exporter: 'substrate',
    query: 'substrate_sync_propagated_transactions{instance="${instance}"}'
  },
  'substrate threads alive': {
    color: {
      background: 'rgb(158, 193, 249, .5)',
      border: 'rgb(158, 193, 249)'
    },
    exporter: 'substrate',
    query: 'substrate_tokio_threads_alive{instance="${instance}"}'
  },
  'block height (finalized)': {
    color: {
      background: 'rgb(158, 193, 249, .5)',
      border: 'rgb(158, 193, 249)'
    },
    exporter: 'substrate',
    query: 'substrate_block_height{instance="${instance}",status="finalized"}'
  },
  'peers': {
    color: {
      background: 'rgb(158, 193, 249, .5)',
      border: 'rgb(158, 193, 249)'
    },
    exporter: 'substrate',
    query: 'substrate_sub_libp2p_peers_count{instance="${instance}"}'
  },
  'established tcp connections': {
    color: {
      background: 'rgb(158, 193, 249, .5)',
      border: 'rgb(158, 193, 249)'
    },
    exporter: 'node',
    query: 'node_netstat_Tcp_CurrEstab{instance="${instance}"}'
  },
  'open rpc sessions': {
    color: {
      background: 'rgb(158, 193, 249, .5)',
      border: 'rgb(158, 193, 249)'
    },
    exporter: 'substrate',
    query: 'substrate_rpc_sessions_opened{instance="${instance}"}-substrate_rpc_sessions_closed{instance="${instance}"}'
  },
  'cpu usage (%)': {
    color: {
      background: 'rgb(158, 193, 249, .5)',
      border: 'rgb(158, 193, 249)'
    },
    exporter: 'node',
    query: '(((count(count(node_cpu_seconds_total{instance="${instance}"}) by (cpu))) - avg(sum by (mode)(rate(node_cpu_seconds_total{mode="idle",instance="${instance}"}[${timespan}])))) * 100) / count(count(node_cpu_seconds_total{instance="${instance}"}) by (cpu))'
  },
  'memory usage (%)': {
    color: {
      background: 'rgb(158, 193, 249, .5)',
      border: 'rgb(158, 193, 249)'
    },
    exporter: 'node',
    query: '((node_memory_MemTotal_bytes{instance="${instance}"} - node_memory_MemFree_bytes{instance="${instance}"}) / (node_memory_MemTotal_bytes{instance="${instance}"} )) * 100'
  },
  'disk usage (%)': {
    color: {
      background: 'rgb(158, 193, 249, .5)',
      border: 'rgb(158, 193, 249)'
    },
    exporter: 'node',
    query: '100 - ((node_filesystem_avail_bytes{instance="${instance}",mountpoint="/",fstype!="rootfs"} * 100) / node_filesystem_size_bytes{instance="${instance}",mountpoint="/",fstype!="rootfs"})'
  },
  'outages': {
    color: {
      background: 'rgb(204, 0, 0, .5)',
      border: 'rgb(204, 0, 0)'
    },
    exporter: 'substrate',
    query: 'ALERTS_FOR_STATE{alertname="offline",instance="${instance}"}'
  }
};
const options = {
  plugins: {
    legend: {
      display: false
    }
  }
};
const lineOptions = {
  ...options,
  elements: {
    point: {
      radius: 0
    }
  }
};
const tabs = {
  node: 'node',
  para: 'parachain',
  relay: 'relay-chain',
};
const unitClass = {
  service: 'journal',
  path: 'arrow-down-right-square',
  socket: 'outlet',
  timer: 'stopwatch',
  target: 'bullseye'
};

function Node(props) {
  const { fqdn } = useParams();
  const [loading, setLoading] = useState(true);
  //const [period, setPeriod] = useState(periods.find(p => p.value === 'h'));
  const [node, setNode] = useState(false);
  const [data, setData] = useState({});
  useEffect(() => {
    fetch(`${apiBaseUrl}/node/${fqdn}`)
      .then(response => response.json())
      .then((container) => {
        if (!!container.error) {
          console.error(container.error);
        } else {
          setNode({
            ...container.node,
            metrics: {
              ...container.node.metrics,
              node: {
                ...container.node.metrics.node,
                units: container.node.metrics.node.latest
                  .filter((m) => m.metric.__name__ === 'node_systemd_unit_state' && m.value[1] === '1')
                  .map((m) => ({
                    name: m.metric.name,
                    state: m.metric.state,
                    time: m.value[0],
                  }))
                  .sort((a, b) => a.name.toLowerCase() > b.name.toLowerCase() ? 1 : a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 0),
              }
            },
          });

          let start = new Date();
          let end = new Date();
          //start.setHours(start.getHours() - 48);
          start.setDate(start.getDate() - 2);

          Object.keys(container.node.metrics).forEach((key) => {
            Object.entries(metrics).filter(([name, m]) => ((key === 'node' && m.exporter === 'node') || (m.exporter === 'substrate'))).forEach(([name, metric]) => {
              const url = {
                scheme: 'https',
                hostname: 'pulse.pelagos.systems',
                path: 'api/v1/query_range',
                params: new URLSearchParams({
                  query: metric.query
                    .replaceAll('${instance}', `${container.node.metrics[key].labels.instance}`)
                    .replaceAll('${timespan}', `2h`),
                  start: start.getTime()/1000.0,
                  end: end.getTime()/1000.0,
                  step: '2h'
                }).toString(),
              };
              fetch(`${url.scheme}://${url.hostname}/${url.path}?${url.params}`)
                .then(response => response.json())
                .then((json) => {
                  if ((json.status === 'success') && !!json.data.result.length) {
                    const labels = json.data.result[0].values.map((v) => new Intl.DateTimeFormat('default', { weekday: 'short', hour: 'numeric', minute: 'numeric' }).format(new Date(Math.trunc(v[0] * 1000))).toLowerCase());
                    const datasets = [
                      {
                        label: name,
                        data: json.data.result[0].values.map((v) => v[1]),
                        backgroundColor: metric.color.background,
                        borderColor: metric.color.border,
                        fill: true,
                      }
                    ];
                    setData((d) => ({
                      ...d,
                      [key]: {
                        ...d[key],
                        [name]: {
                          labels,
                          datasets,
                        }
                      }
                    }));
                  } else {
                    setData((d) => ({
                      ...d,
                      [key]: {
                        ...d[key],
                        [name]: {
                          json,
                        }
                      }
                    }));
                  }
                  setLoading(false);
                 })
                .catch((error) => {
                  setData((d) => ({
                    ...d,
                    [key]: {
                      ...d[key],
                      [name]: {
                        error,
                        endpoint: `${url.scheme}://${url.hostname}/${url.path}?${url.params}`
                      }
                    }
                  }));
                  setLoading(false);
                });
            })
          });
        }
      })
      .catch((error) => {
        console.error(error);
      });
  }, [fqdn]);
  return (
    <Fragment>
      {
        (!!node && !!node.blockchain)
          ? (node.blockchain.tier === 'parachain')
            ? (
                <h2>
                  <Link to={`/chain/${node.blockchain.relay}/${node.blockchain.name}`} style={{textDecoration: 'none'}}>
                    {node.blockchain.name} <sup><em className="text-muted">{node.blockchain.relay}</em></sup>
                  </Link>
                </h2>
              )
            : (
                <h2 as={Link} to={`/chain/${node.blockchain.name}`}>
                  {node.blockchain.name}
                </h2>
              )
          : null
      }
      <h3>{fqdn}</h3>
      <Row>
        {
          (!!node)
            ? (
                <Table striped>
                  <tbody>
                    {
                      (!!node.metrics)
                        ? (
                            <Fragment>
                              <tr>
                                <th>
                                  telemetry name
                                </th>
                                <td>
                                  {node.metrics[(node.blockchain.tier === 'parachain') ? 'para' : 'relay'].latest.find((m) => m.metric.__name__ === 'substrate_build_info').metric.name}
                                </td>
                              </tr>  
                              <tr>
                                <th>
                                  substrate version
                                </th>
                                <td>
                                  {node.metrics[(node.blockchain.tier === 'parachain') ? 'para' : 'relay'].latest.find((m) => m.metric.__name__ === 'substrate_build_info').metric.version}
                                </td>
                              </tr>
                            </Fragment>
                          )
                        : null
                    }
                    <tr>
                      <th>
                        uptime
                      </th>
                      <td>
                        <ul style={{marginBottom: '0'}}>
                          {
                            (!!node.launch)
                              ? (
                                  <li>
                                    node launch:
                                    <span style={{marginLeft: '0.5em'}}>
                                      {new Intl.DateTimeFormat('default', { dateStyle: 'full', timeStyle: 'long' }).format(new Date(node.launch)).toLowerCase()}
                                    </span>
                                    <em style={{marginLeft: '0.5em'}} className="text-muted">
                                      {dateDiff(new Date(node.launch), null, 3)} ago
                                    </em>
                                  </li>
                                )
                              : null
                          }
                          {
                            (!!node.metrics && !!node.metrics[(node.blockchain.tier === 'parachain') ? 'para' : 'relay'])
                              ? (
                                  <li>
                                    substrate (re)start:
                                    <span style={{marginLeft: '0.5em'}}>
                                      {
                                        new Intl.DateTimeFormat('default', { dateStyle: 'full', timeStyle: 'long' }).format(
                                          new Date(
                                            parseInt(
                                              node.metrics[(node.blockchain.tier === 'parachain') ? 'para' : 'relay'].latest
                                                .find((m) => m.metric.__name__ === 'substrate_process_start_time_seconds')
                                                .value[1]
                                            ) * 1000
                                          )
                                        ).toLowerCase()
                                      }
                                    </span>
                                    <em style={{marginLeft: '0.5em'}} className="text-muted">
                                      {
                                        dateDiff(
                                          new Date(
                                            parseInt(
                                              node.metrics[(node.blockchain.tier === 'parachain') ? 'para' : 'relay'].latest
                                                .find((m) => m.metric.__name__ === 'substrate_process_start_time_seconds')
                                                .value[1]
                                            ) * 1000
                                          ), null, 3
                                        )
                                      } ago
                                    </em>
                                  </li>
                                )
                              : null
                          }
                        </ul>
                      </td>
                    </tr>
                    {
                      ['id', 'ami', 'machine', 'region', 'ip', 'state'].map((property, pI) => (
                        <tr key={pI}>
                          <th>
                            {property}
                          </th>
                          <td>
                            {node[property]}
                          </td>
                        </tr>
                      ))
                    }
                    {
                      (!!node.location)
                        ? (
                            <tr>
                              <th>
                                location
                              </th>
                              <td>
                                {node.location.country.flag} {node.location.city.name.toLowerCase()}, {node.location.country.name.toLowerCase()}
                              </td>
                            </tr>
                          )
                        : null
                    }
                    {
                      (!!node.blockchain)
                        ? (
                            <tr>
                              <th>
                                configuration
                              </th>
                              <td>
                                <a href={`https://github.com/Manta-Network/pelagos/blob/main/terraform/deployment/${
                                  (node.blockchain.tier === 'parachain')
                                    ? `${node.blockchain.relay}/${node.blockchain.name}`
                                    : node.blockchain.name
                                  }/${node.hostname}/main.tf`}>
                                  terraform
                                </a>
                              </td>
                            </tr>
                          )
                        : null
                    }
                    {
                      (!!node.metrics)
                        ? (
                            <tr>
                              <th>
                                metrics
                              </th>
                              <td>
                                {
                                  (!!node.metrics.node)
                                    ? (
                                        <a href={`https://grafana.pulse.pelagos.systems/d/rYdddlPWk/node-exporter-full?var-job=${encodeURIComponent(node.metrics.node.labels.job)}&var-node=${node.metrics.node.labels.instance}`}>
                                          node
                                        </a>
                                      )
                                    : null
                                }
                              </td>
                            </tr>
                          )
                        : null
                    }
                    <tr>
                      <th>
                        certificate
                      </th>
                      <td>
                        {
                          (!!node.certificate)
                            ? (
                                <Fragment>
                                  <ul style={{marginBottom: '0'}}>
                                    <li>
                                      issuer: {node.certificate.issuer.O.toLowerCase()}
                                    </li>
                                    <li>
                                      validity:
                                      <ul>
                                        <li>
                                          from: {new Intl.DateTimeFormat('default', { dateStyle: 'full', timeStyle: 'long' }).format(new Date(node.certificate.valid_from)).toLowerCase()}
                                          <em style={{marginLeft: '0.5em'}} className="text-muted">
                                            {dateDiff(new Date(node.certificate.valid_from), null, 2)} ago
                                          </em>
                                        </li>
                                        <li className={`text-${
                                            (new Date(node.certificate.valid_to) <= new Date((new Date()).valueOf() + (1000 * 60 * 60 * 24 * 7)))
                                              ? 'text-danger'
                                              : (new Date(node.certificate.valid_to) <= new Date((new Date()).valueOf() + (1000 * 60 * 60 * 24 * 30)))
                                                ? 'text-warning'
                                                : null
                                          }`}>
                                          to: {new Intl.DateTimeFormat('default', { dateStyle: 'full', timeStyle: 'long' }).format(new Date(node.certificate.valid_to)).toLowerCase()}
                                          <em style={{marginLeft: '0.5em'}} className="text-muted">
                                            {dateDiff(new Date(node.certificate.valid_to), null, 2)} {(new Date(node.certificate.valid_to) > new Date()) ? 'from now' : 'ago'}
                                          </em>
                                        </li>
                                      </ul>
                                    </li>
                                    <li>
                                      subject(s):
                                      <ul>
                                      {
                                        [...(new Set([...[node.certificate.subject.CN], ...node.certificate.subjectaltname.replaceAll('DNS:', '').split(', ')]))].map((hostname, hI) => (
                                          <li key={hI} style={{fontWeight: (hI === 0) ? 'bold' : 'normal'}}>
                                            {hostname}
                                          </li>
                                        ))
                                      }
                                      </ul>
                                    </li>
                                  </ul>
                                </Fragment>
                              )
                            : (
                                <span className="text-danger">
                                  none
                                </span>
                              )
                        }
                      </td>
                    </tr>
                  </tbody>
                </Table>
              )
            : (
                <Spinner animation="border">
                  <span className="visually-hidden">node lookup in progress</span>
                </Spinner>
              )
        }
      </Row>
      <h3>metrics</h3>
      <Tabs defaultActiveKey="node">
        {
          (!!node.metrics && !!Object.keys(node.metrics).length)
            ? (
                Object.keys(node.metrics).map((tab, tI) => (
                  <Tab key={tI} eventKey={tab} title={
                    (
                      <span>
                        {tabs[tab]}
                      </span>
                    )
                  }>
                    <Row xs={1} md={3} className="g-4">
                      {
                        Object.keys(metrics)
                          .filter((m) => metrics[m].exporter === ((tab === 'node') ? 'node' : 'substrate'))
                          .sort((a, b) => (a > b) ? 1 : (a < b) ? -1 : 0)
                          .map((name, mI) => (
                          <Col key={mI}>
                            <Card>
                              <Card.Body>
                                <Card.Title>{name}</Card.Title>
                                {
                                  (!!data[tab] && !!data[tab][name] && !!data[tab][name].datasets)
                                    ? (
                                        <Chart type={`line`} options={lineOptions} plugins={[CategoryScale]} data={data[tab][name]} />
                                      )
                                    : !!loading
                                      ? (
                                          <Spinner animation="border">
                                            <span className="visually-hidden">metrics lookup in progress</span>
                                          </Spinner>
                                        )
                                      : (
                                          <Card.Text>
                                            none
                                          </Card.Text>
                                        )
                                }
                              </Card.Body>
                            </Card>
                          </Col>
                        ))
                      }
                      {
                        (tab !== 'node' && !!node.metrics[tab] && !!node.metrics[tab].parsed && !!node.metrics[tab].parsed.length)
                          ? node.metrics[tab].parsed.filter((p) => p.type === 'HISTOGRAM' && Object.values(p.metrics[0].buckets).some((v) => (v > 0))).map((pm, pmI) => (
                              <Col key={pmI}>
                                <Card>
                                  <Card.Body>
                                    <Card.Title>
                                      {pm.name.replace('substrate_', '').replaceAll('_', ' ').toLowerCase()}
                                    </Card.Title>
                                    <Card.Text>
                                      {pm.type.toLowerCase()}: {pm.help.toLowerCase()}
                                    </Card.Text>
                                    <Chart type="bar" options={options} data={{
                                      labels: Object.keys(pm.metrics[0].buckets),
                                      datasets: [{
                                        data: Object.values(pm.metrics[0].buckets).map((v) => parseInt(v)),
                                        backgroundColor: 'rgb(158, 193, 249, .5)',
                                        borderColor: 'rgb(158, 193, 249)'
                                      }]
                                    }} />
                                  </Card.Body>
                                </Card>
                              </Col>
                            ))
                          : null
                      }
                    </Row>
                  </Tab>
                ))
              )
            : null
        }
      </Tabs>
      {
        (!!node.metrics && !!node.metrics.node && !!node.metrics.node.units && !!node.metrics.node.units.length)
          ? (
              <Row>
                <h3>systemd</h3>
                <Tabs defaultActiveKey="service">
                  {
                    [...(new Set(node.metrics.node.units.map(u => u.name.split('.').slice(-1)[0])))].map((tab) => (
                      <Tab key={tab} eventKey={tab} title={(
                          <span>
                            <i className={`bi bi-${unitClass[tab]}`} title={tab} style={{marginRight: '0.5em'}} />
                            {tab}
                          </span>
                        )}>
                        <Tabs defaultActiveKey="active">
                        {
                          [...(new Set(node.metrics.node.units.filter(u => u.name.endsWith(`.${tab}`)).map(u => u.state)))].map((state) => (
                            <Tab key={state} eventKey={state} title={(
                                <span>
                                  <i className={`bi bi-${((state === 'active') ? 'activity' : (state === 'inactive') ? 'stop' : 'exclamation-square')} text-${((state === 'active') ? 'success' : (state === 'inactive') ? 'warning' : 'danger')}`} title={state} style={{marginRight: '0.5em'}} />
                                  {state}
                                  <Badge pill bg="dark" style={{marginLeft: '0.5em'}}>
                                    {node.metrics.node.units.filter(u => u.name.endsWith(`.${tab}`) && u.state === state).length}
                                  </Badge>
                                  
                                </span>
                              )}>
                              <Table striped>
                                <tbody>
                                  {
                                    node.metrics.node.units.filter(u => u.name.endsWith(`.${tab}`) && u.state === state).map((unit, sI) => (
                                      <tr key={sI}>
                                        <th>
                                          <i className={`bi bi-${unitClass[tab]}`} title={tab} style={{fontWeight: 'normal', marginRight: '0.5em'}} />
                                          {unit.name.replace(`.${tab}`, '')}
                                          <span className="text-muted" style={{fontWeight: 'normal'}}>.{tab}</span>
                                        </th>
                                        <td>
                                          <i className={`bi bi-${((unit.state === 'active') ? 'activity' : (unit.state === 'inactive') ? 'stop' : 'exclamation-square')} text-${((unit.state === 'active') ? 'success' : (unit.state === 'inactive') ? 'warning' : 'danger')}`} title={unit.state} style={{marginRight: '0.5em'}} />
                                          {unit.state} {/*new Intl.DateTimeFormat('default', { hour: 'numeric', minute: 'numeric' }).format(unit.time).toLowerCase()*/}
                                        </td>
                                      </tr>
                                    ))
                                  }
                                </tbody>
                              </Table>
                            </Tab>
                          ))
                        }
                      </Tabs>
                    </Tab>
                  ))
                }
                </Tabs>
              </Row>
            )
          : null
      }
    </Fragment>
  );
}

export default Node;
