import { useEffect, useState } from 'react';
import ProgressBar from 'react-bootstrap/ProgressBar';
import Spinner from 'react-bootstrap/Spinner';
import getWsConnections from './getWsConnections';

const threshold = {
  danger: 0.85,
  warning: 0.66,
};

function NodeConnections(props) {
  const { fqdn } = props;
  const [wsConnections, setWsConnections] = useState({ active: 0, max: 100 });
  useEffect(() => {
    getWsConnections(fqdn).then(setWsConnections);
  }, [fqdn]);
  return (
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
  );
}

export default NodeConnections;
