import { useState } from 'react';
import Button from 'react-bootstrap/Button';
import Col from 'react-bootstrap/Col';
import Row from 'react-bootstrap/Row';
import Tab from 'react-bootstrap/Tab';
import Tabs from 'react-bootstrap/Tabs';
import ChainHealth from './ChainHealth';

function Dashboard(props) {
  const now = new Date();
  const timespans = [
    {
      title: 'last hour',
      from: new Date(new Date().getTime() - (60 * 60 * 1000)),
      to: now,
    },
    {
      title: 'last 3 hours',
      from: new Date(new Date().getTime() - (3 * 60 * 60 * 1000)),
      to: now,
    },
    {
      title: 'last 24 hours',
      from: new Date(new Date(now).setDate(now.getDate() - 1)),
      to: now,
    },
    {
      title: 'last 3 days',
      from: new Date(new Date(now).setDate(now.getDate() - 3)),
      to: now,
    },
    {
      title: 'last 7 days',
      from: new Date(new Date(now).setDate(now.getDate() - 7)),
      to: now,
    },
    {
      title: 'last month',
      from: new Date(new Date(now).setMonth(now.getMonth() - 1)),
      to: now,
    },
    /* enable when we have more observation data
    {
      title: 'last 3 months',
      from: new Date(new Date(now).setMonth(now.getMonth() - 3)),
      to: now,
    },
    {
      title: 'last 6 months',
      from: new Date(new Date(now).setMonth(now.getMonth() - 6)),
      to: now,
    },
    {
      title: 'last 12 months',
      from: new Date(new Date(now).setMonth(now.getMonth() - 12)),
      to: now,
    },
    */
  ];
  const [timespan, setTimespan] = useState(timespans.find((x) => (x.title === 'last 3 days')));
  const { blockchains } = props;
  const networks = [...new Set(blockchains.map((blockchain) => blockchain.network).sort())];
  return (
    <Row>
      <Col sm={10}>
        <Tabs defaultActiveKey={networks[0]} unmountOnExit={true}>
          {
            networks.map((network) => (
              <Tab key={network} eventKey={network} title={`${network.replace('testnet (', '').replace(')', '')}${network.startsWith('testnet') ? ' testnet' : ''}`}>
                {
                  blockchains.filter((blockchain) => blockchain.network === network).map((blockchain) => (
                    <ChainHealth key={blockchain.chain} blockchain={blockchain} timespan={timespan} />
                  ))
                }
              </Tab>
            ))
          }
        </Tabs>
      </Col>
      <Col sm={2}>
        {
          timespans.map((x) => (
            <div key={x.title} style={{marginBottom: '10px'}}>
              <Button
                title={`${x.from} - ${x.to}`}
                variant={(x.title === timespan.title) ? 'primary' : 'secondary'}
                onClick={() => setTimespan(x)}
                style={{width: '100%'}}>
                {x.title}
              </Button>
            </div>
          ))
        }
      </Col>
    </Row>
  );
}

export default Dashboard;
