import { useEffect, useState } from 'react';
import Badge from 'react-bootstrap/Badge';
import Spinner from 'react-bootstrap/Spinner';

function NodeHealth(props) {
  const { fqdn } = props;
  const [healths, setHealths] = useState({
    0: null,
    1: null,
    2: null,
  });
  useEffect(() => {
    const domain = fqdn.split('.').slice(1).join('.');
    switch (domain) {
      case 'internal.kusama.systems':
        [0,1,2].map((n) => (
          fetch(`https://${fqdn}/${n}/health`)
            .then(r => r.json())
            .then((fetchedHealth) => setHealths((h) => ({...h, [n]: fetchedHealth})))
            .catch(console.error)
        ));
        break;
      default:
        fetch(`https://${fqdn}/health`)
          .then(r => r.json())
          .then((fetchedHealth) => setHealths({0: fetchedHealth}))
          .catch(console.error);
        break;
    }
  }, [fqdn]);
  return (
    (!!healths[0])
      ? Object.values(healths).filter((h) => !!h).map((health, hI) => (
          <span key={hI} style={{...props.style}}>
            {
              (!!health.peers)
                ? (
                    <Badge title={`${health.peers} peers`} pill bg="success" style={{marginLeft: '0.5em'}}>
                      <i className={`bi bi-people`} />
                      <span style={{marginLeft: '0.5em'}}>{health.peers}</span>
                    </Badge>
                  )
                : (
                    <Spinner style={{...props.style}} animation="border" size="sm" className="text-secondary">
                      <span className="visually-hidden">node peer count lookup in progress</span>
                    </Spinner>
                  )
            }
            {
              (health.isSyncing === true)
                ? (
                    <Spinner title={`node sync in progress`} style={{marginLeft: '0.5em', ...props.style}} animation="grow" size="sm" className={`text-warn`} variant="warning">
                      <span className="visually-hidden">node sync in progress</span>
                    </Spinner>
                  )
                : (
                    <i style={{marginLeft: '0.5em'}} title={`node sync complete`} className={`bi bi-arrow-repeat text-success`} />
                  )
            }
          </span>
        ))
      : (
          <Spinner style={{...props.style}} animation="border" size="sm" className="text-secondary">
            <span className="visually-hidden">node health lookup in progress</span>
          </Spinner>
        )
  );
}

export default NodeHealth;
