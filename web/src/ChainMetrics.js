import React, { Fragment, useState, useEffect } from 'react';
import Alert from 'react-bootstrap/Alert';
import Dropdown from 'react-bootstrap/Dropdown';
import Row from 'react-bootstrap/Row';
import Spinner from 'react-bootstrap/Spinner';
import {
  Chart as ChartJS,
  CategoryScale,
  registerables
} from 'chart.js';
import { Chart } from 'react-chartjs-2';
import palette from 'google-palette';
ChartJS.register(...registerables);

const periods = [
  { label: 'minute', value: 'm' },
  { label: 'hour', value: 'h' },
  { label: 'day', value: 'd' }
];

function ChainMetrics(props) {
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(periods.find(p => p.value === 'h'));
  const [data, setData] = useState({ labels: [], datasets: [] });
  useEffect(() => {
    if (!!props.blockchain) {
      let start = new Date();
      let end = new Date();
      start.setDate(start.getDate() - 1);
      const url = {
        scheme: 'https',
        hostname: 'pulse.pelagos.systems',
        path: 'api/v1/query',
        params: new URLSearchParams({
          // todo: fix prometheus job names
          query: `node_netstat_Tcp_CurrEstab{job=~".*${props.blockchain.replace('kusama/calamari', 'calamari').replace('rococo/dolphin', 'dolphin').replace('polkadot/manta', 'manta')}.*"}[1${period.value}]`,
          start: start.getTime()/1000.0,
          end: end.getTime()/1000.0,
        }).toString(),
      };
      fetch(`${url.scheme}://${url.hostname}/${url.path}?${url.params}`)
        .then(response => response.json())
        .then((json) => {
          if ((json.status === 'success') && !!json.data.result.length) {
            const instances = json.data.result.map((r) => r.metric.instance);
            const colors = palette('mpn65', instances.length);
            const labels = json.data.result[0].values.map((value) => new Intl.DateTimeFormat('default', { weekday: 'short', hour: 'numeric', minute: 'numeric' }).format(new Date(Math.trunc(value[0] * 1000))).toLowerCase());
            const datasets = instances.map((instance, i) => ({
              label: instance.split('.')[0],
              data: json.data.result.find((r) => r.metric.instance === instance).values.map((value) => value[1]),
              backgroundColor: `#${colors[i]}`,
              borderColor: `#${colors[i]}`,
            }));
            setData({ labels, datasets });
          } else {
            //console.error(`no data available from endpoint: ${url.scheme}://${url.hostname}/${url.path}?${url.params}`);
            setData({
              labels: [],
              datasets: [],
              error: `no metrics data available from endpoint:`,
              endpoint: `${url.scheme}://${url.hostname}/${url.path}?${url.params}` 
            });
          }
          setLoading(false);
         })
        .catch((error) => {
          console.error(error);
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, [props.blockchain, period]);
  return (!!props.blockchain)
    ? (
        <Fragment>
          {
            (!loading && !!data.datasets.length)
              ? (
                  <Row>
                    <span>tcp connections in the last</span>
                    <Dropdown>
                      <Dropdown.Toggle>
                        {period.label}
                      </Dropdown.Toggle>
                      <Dropdown.Menu>
                        {
                          periods.map((period) => (
                            <Dropdown.Item key={period.value} onClick={() => { setPeriod(period); setLoading(true); }}>
                              {period.label}
                            </Dropdown.Item>
                          ))
                        }
                      </Dropdown.Menu>
                    </Dropdown>
                  </Row>
                )
              : null
          }
          <Row>
            {
              (loading)
                ? (
                    <Spinner animation="border">
                      <span className="visually-hidden">metrics lookup in progress</span>
                    </Spinner>
                  )
                : (!!data.datasets.length)
                  ? (
                      <Chart type={`line`} options={{elements:{point:{radius:0}}}} plugins={[CategoryScale]} data={data} />
                    )
                  : (!!data.error && !! data.endpoint)
                    ? (
                        <Alert variant={'warning'}>
                          {data.error}
                          <br />
                          <a href={data.endpoint}>{data.endpoint}</a>
                        </Alert>
                      )
                    : (
                        <Alert variant={'warning'}>no metrics data available</Alert>
                      )
            }
          </Row>
        </Fragment>
      )
    : null;
}

export default ChainMetrics;
