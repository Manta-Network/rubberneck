import { Fragment, useEffect, useState } from 'react';
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
            health
          </span>
        )
      : (
          <Spinner style={{...props.style}} animation="border" size="sm">
            <span className="visually-hidden">observations lookup in progress</span>
          </Spinner>
        )
  );
}

export default NodeHealth;