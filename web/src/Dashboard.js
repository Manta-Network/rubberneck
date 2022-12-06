import { useState } from 'react';
import Button from 'react-bootstrap/Button';
import Col from 'react-bootstrap/Col';
import Row from 'react-bootstrap/Row';
import Tab from 'react-bootstrap/Tab';
import Tabs from 'react-bootstrap/Tabs';
import ChainHealth from './ChainHealth';

function Dashboard(props) {
  const timespans = [
    {
      title: 'last hour',
      from: new Date(new Date().getTime() - (60 * 60 * 1000)),
      to: new Date(),
    },
    {
      title: 'last 3 hours',
      from: new Date(new Date().getTime() - (3 * 60 * 60 * 1000)),
      to: new Date(),
    },
    {
      title: 'last 24 hours',
      from: new Date(new Date().getTime() - (24 * 60 * 60 * 1000)),
      to: new Date(),
    },
    {
      title: 'last 3 days',
      from: new Date(new Date().getTime() - (3 * 24 * 60 * 60 * 1000)),
      to: new Date(),
    },
    {
      title: 'last 7 days',
      from: new Date(new Date().getTime() - (7 * 24 * 60 * 60 * 1000)),
      to: new Date(),
    },
    {
      title: 'last 30 days',
      from: new Date(new Date().getTime() - (30 * 24 * 60 * 60 * 1000)),
      to: new Date(),
    },
  ];
  const [timespan, setTimespan] = useState(timespans.find((x) => (x.title === 'last 24 hours')));
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
