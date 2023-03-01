import { useEffect, useState } from 'react';
import ProgressBar from 'react-bootstrap/ProgressBar';
import Spinner from 'react-bootstrap/Spinner';

const threshold = {
  danger: 0.85,
  warning: 0.66,
};

function NodeConnections(props) {
  const { fqdn } = props;
  const [connections, setConnections] = useState(0);
  useEffect(() => {
    fetch(`https://pulse.pelagos.systems/api/v1/query?query=nginx_connections_active{instance%3D%22${fqdn}:443%22}`)
      .then(r => r.json())
      .then((container) => {
        if (!!container.data && !!container.data.result && !!container.data.result.length) {
          setConnections(container.data.result[0].value[1]);
        }
      })
      .catch(console.error);
  }, [fqdn]);
  return (
    (!!connections)
      ? (
          <ProgressBar
            now={((connections / 1000) * 100)}
            title={`connections: ${connections} / 1000`}
            variant={
              ((connections / 1000) > threshold.danger)
                ? 'danger'
                : ((connections / 1000) > threshold.warning)
                  ? 'warning'
                  : 'success'
            }
          />
        )
      : (
          <Spinner style={{...props.style}} animation="grow" size="sm" className="text-secondary">
            <span className="visually-hidden">tcp connection count lookup in progress</span>
          </Spinner>
        )
  );
}

export default NodeConnections;
