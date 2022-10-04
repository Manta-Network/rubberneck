import { Fragment, useEffect, useState } from 'react';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import Popover from 'react-bootstrap/Popover';
import Spinner from 'react-bootstrap/Spinner';

const color = {
  green: '#41986a',
  amber: '#ee9b04',
  red: '#e30000'
};

function NodeObservations(props) {
  const { fqdn } = props;
  const [data, setData] = useState(undefined);
  useEffect(() => {
    fetch(`https://5eklk8knsd.execute-api.eu-central-1.amazonaws.com/prod/node/${fqdn}/observations`)
      .then(response => response.json())
      .then((container) => {
        if (!!container.error) {
          console.error(container.error);
        } else {
          setData({
            outages: container.observations.filter((o) => !((o.cert_validity_days > 0) && (o.peers_connected > 0) && (o.websocket_redponsive))).length,
            first: new Intl.DateTimeFormat('default', { weekday: 'short', hour: 'numeric', minute: 'numeric' }).format(new Date(container.observations[0].observed)).toLowerCase(),
            last: new Intl.DateTimeFormat('default', { weekday: 'short', hour: 'numeric', minute: 'numeric' }).format(new Date(container.observations.slice(-1)[0].observed)).toLowerCase(),
            observations: container.observations
          });
        }
      })
      .catch((error) => {
        console.error(error);
      });
  }, [fqdn]);
  return (
    (!!data)
      ? (
          <OverlayTrigger
            placement="bottom"
            overlay={
              <Popover>
                <Popover.Header as="strong">
                  {data.first} - {data.last}
                </Popover.Header>
                <Popover.Body>
                  {
                    (!!data.outages)
                      ? (
                          <strong>{data.outages} outage{data.outages === 1 ? '' : 's'} observed</strong>
                        )
                      : `no outages`
                  }
                  {
                    (!!data.outages)
                      ? (
                          <ul style={{marginLeft: 0, paddingLeft: 0}}>
                            {
                              data.observations.filter((o) => !((o.cert_validity_days > 0) && (o.peers_connected > 0) && (o.websocket_redponsive))).map((o, oI) => (
                                <li key={oI} style={{listStyleType: 'none'}}>
                                  {new Intl.DateTimeFormat('default', { weekday: 'short', hour: 'numeric', minute: 'numeric' }).format(new Date(o.observed)).toLowerCase()}
                                  <ul>
                                    <li>
                                      cert: <span style={{color: (o.cert_validity_days > 0) ? color.green : color.red}}>{(o.cert_validity_days > 0) ? 'valid' : 'expired'}</span>
                                    </li>
                                    <li>
                                      peers: <span style={{color: (o.peers_connected > 0) ? color.green : color.red}}>{o.peers_connected}</span>
                                    </li>
                                    <li>
                                      websocket: <span style={{color: (o.websocket_redponsive) ? color.green : color.red}}>{(o.websocket_redponsive) ? 'up' : 'down'}</span>
                                    </li>
                                  </ul>
                                </li>
                              ))
                            }
                          </ul>
                        )
                      : null
                  }
                </Popover.Body>
              </Popover>
            }
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${data.observations.length * 10} 20`} style={{ maxHeight: '48px'}}>
              <g>
                {
                  data.observations.map((o, oI) => {
                    const outer = {
                      cx: 5 + (oI * 10),
                      cy: 10,
                      r: 4,
                      stroke: ((o.cert_validity_days > 0) && (o.peers_connected > 0) && (o.websocket_redponsive))
                        ? color.green
                        : (o.peers_connected > 0)
                            ? color.amber
                            : color.red,
                      fill: 'white'
                    };
                    const inner = {
                      cx: outer.cx,
                      cy: outer.cy,
                      r: outer.r - 1,
                      fill: outer.stroke,
                      opacity: 0.5
                    };
                    return (
                      <Fragment key={oI}>
                        <circle {...outer} />
                        <circle {...inner} />
                      </Fragment>
                    );
                  })
                }
              </g>
            </svg>
          </OverlayTrigger>
        )
      : (
          <Spinner animation="border" size="sm">
            <span className="visually-hidden">observations lookup in progress</span>
          </Spinner>
        )
  );
}

export default NodeObservations;
