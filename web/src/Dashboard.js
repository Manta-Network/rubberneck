import { Fragment, useEffect, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  registerables
} from 'chart.js';
import { Chart } from 'react-chartjs-2';
import palette from 'google-palette';
ChartJS.register(...registerables);

function Dashboard() {
  const [dnsMetrics, setDnsMetrics] = useState(false);
  useEffect(() => {
    fetch('https://0fcyrs44t4.execute-api.us-east-1.amazonaws.com/prod/dns')
      .then(response => response.json())
      .then((container) => {
        if (!!container.error) {
          console.error(container.error);
        } else {
          
          const colors = palette('mpn65', container.metrics.datasets.length);
          setDnsMetrics({
            ...container.metrics,
            labels: container.metrics.labels.map((label) => new Intl.DateTimeFormat('default', { weekday: 'short', hour: 'numeric', minute: 'numeric' }).format(new Date(label)).toLowerCase()),
            datasets: container.metrics.datasets.map((dataset, dI) => ({
              ...dataset,
              backgroundColor: `#${colors[dI]}`,
              borderColor: `#${colors[dI]}`,
            }))
          });
        }
      })
      .catch((error) => {
        console.error(error);
      });
  });
  return (
    <Fragment>
      <h2>dns queries by tld</h2>
      {
        (!!dnsMetrics)
          ? (
              <Chart type={`line`} plugins={[CategoryScale]} data={dnsMetrics} />
            )
          : null
      }
    </Fragment>
  );
}

export default Dashboard;