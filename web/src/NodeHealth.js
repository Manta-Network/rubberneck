import { Fragment, useEffect, useState } from 'react';
import Badge from 'react-bootstrap/Badge';
import Spinner from 'react-bootstrap/Spinner';

function NodeHealth(props) {
  const { fqdn } = props;
  const [health, setHealth] = useState(undefined);
  useEffect(() => {
    fetch(`https://${fqdn}/health`)
      .then(r => r.json())
      .then(setHealth)
      .catch(console.error);
  }, [fqdn]);
  return (
    (!!health)
      ? (
          <span style={{...props.style}}>
            {
              (!!health.peers)
                ? (
                    <Badge title={`${health.peers} peers`} pill bg="success" style={{marginLeft: '0.5em'}}>
                      <i className={`bi bi-people`} />
                      <span style={{marginLeft: '0.5em'}}>{health.peers}</span>
                    </Badge>
                  )
                : (
                    <i title={`no peers`} className={`bi bi-people text-danger`} />
                  )
            }
            {
              (health.isSyncing === true)
                ? (
                    <Spinner title={`node sync in progress`} style={{...props.style}} animation="border" size="sm" className={`text-warn`}>
                      <span className="visually-hidden">node sync in progress</span>
                    </Spinner>
                  )
                : (
                    <i style={{marginLeft: '0.5em'}} title={`node sync complete`} className={`bi bi-arrow-repeat text-success`} />
                  )
            }
          </span>
        )
      : (
          <Spinner style={{...props.style}} animation="grow" size="sm" className="text-secondary">
            <span className="visually-hidden">node health lookup in progress</span>
          </Spinner>
        )
  );
}

export default NodeHealth;