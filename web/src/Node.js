import { Link, useParams } from 'react-router-dom';
import { Fragment, useEffect, useState } from 'react';
import Card from 'react-bootstrap/Card';
import Col from 'react-bootstrap/Col';
import Row from 'react-bootstrap/Row';
import Spinner from 'react-bootstrap/Spinner';
import Table from 'react-bootstrap/Table';
import {
  Chart as ChartJS,
  CategoryScale,
  registerables
} from 'chart.js';
import { Chart } from 'react-chartjs-2';
ChartJS.register(...registerables);

const metrics = {
  tcp: {
    query: 'node_netstat_Tcp_CurrEstab{instance="${instance}"}'
  },
  cpu: {
    query: '(((count(count(node_cpu_seconds_total{instance="${instance}"}) by (cpu))) - avg(sum by (mode)(rate(node_cpu_seconds_total{mode="idle",instance="${instance}"}[${timespan}])))) * 100) / count(count(node_cpu_seconds_total{instance="${instance}"}) by (cpu))'
  },
  ram: {
    query: '((node_memory_MemTotal_bytes{instance="${instance}"} - node_memory_MemFree_bytes{instance="${instance}"}) / (node_memory_MemTotal_bytes{instance="${instance}"} )) * 100'
  },
  disk: {
    query: '100 - ((node_filesystem_avail_bytes{instance="${instance}",mountpoint="/",fstype!="rootfs"} * 100) / node_filesystem_size_bytes{instance="${instance}",mountpoint="/",fstype!="rootfs"})'
  },
};
const options = {
  elements: {
    point: {
      radius: 0
    }
  },
  plugins: {
    legend: {
      display: false
    }
  }
};

function Node(props) {
  const { fqdn } = useParams();
  const [loading, setLoading] = useState(true);
  //const [period, setPeriod] = useState(periods.find(p => p.value === 'h'));
  const [node, setNode] = useState(false);
  useEffect(() => {
    fetch(`https://5eklk8knsd.execute-api.eu-central-1.amazonaws.com/prod/node/${fqdn}`)
      .then(response => response.json())
      .then((container) => {
        if (!!container.error) {
          console.error(container.error);
        } else {
          setNode(container.node);
        }
      })
      .catch((error) => {
        console.error(error);
      });
  }, [fqdn]);
  const [data, setData] = useState({});
  useEffect(() => {
    if (!!fqdn) {
      let start = new Date();
      let end = new Date();
      //start.setHours(start.getHours() - 48);
      start.setDate(start.getDate() - 2);
      Object.entries(metrics).forEach(([name, metric]) => {
        const url = {
          scheme: 'https',
          hostname: 'pulse.pelagos.systems',
          path: 'api/v1/query_range',
          params: new URLSearchParams({
            // todo: use target instance rather than generated
            query: metric.query.replaceAll('${instance}', `${fqdn}:443`).replaceAll('${timespan}', `${1}h`),
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
                  backgroundColor: 'rgb(158, 193, 249, .5)',
                  borderColor: 'rgb(158, 193, 249)',
                  fill: true,
                }
              ];
              setData((d) => ({
                ...d,
                [name]: {
                  labels,
                  datasets,
                }
              }));
            } else {
              setData((d) => ({
                ...d,
                [name]: {
                  json,
                }
              }));
            }
            setLoading(false);
           })
          .catch((error) => {
            setData((d) => ({
              ...d,
              [name]: {
                error,
                endpoint: `${url.scheme}://${url.hostname}/${url.path}?${url.params}`
              }
            }));
            setLoading(false);
          });
      })
    } else {
      setLoading(false);
    }
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
                      (!!node.launch)
                        ? (
                            <tr>
                              <th>
                                launch
                              </th>
                              <td>
                                {new Intl.DateTimeFormat('default', {dateStyle: 'full', timeStyle: 'long' }).format(new Date(node.launch)).toLowerCase()}
                              </td>
                            </tr>
                          )
                        : null
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
                                <a href={`https://github.com/Manta-Network/pelagos/blob/main/terraform/deployment/${(node.blockchain.tier === 'parachain') ? `${node.blockchain.relay}/${node.blockchain.name}` : node.blockchain.relay}/${node.hostname}/main.tf`}>
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
      <Row xs={1} md={3} className="g-4">
        {
          Object.keys(metrics).map((name, mI) => (
            <Col key={mI}>
              <Card>
                <Card.Body>
                  <Card.Title>{name}</Card.Title>
                  {
                    (!!data[name] && !!data[name].datasets)
                      ? (
                          <Chart type={`line`} options={options} plugins={[CategoryScale]} data={data[name]} />
                        )
                      : !!loading
                        ? (
                            <Spinner animation="border">
                              <span className="visually-hidden">metrics lookup in progress</span>
                            </Spinner>
                          )
                        : null
                  }
                </Card.Body>
              </Card>
            </Col>
          ))
        }
      </Row>
      {
        /*
      <pre>
        {JSON.stringify(data, null, 2)}
      </pre>
        */
      }
    </Fragment>
  );
}

export default Node;
