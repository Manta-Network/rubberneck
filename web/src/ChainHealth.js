import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Spinner from 'react-bootstrap/Spinner';
import apiBaseUrl from './apiBaseUrl';

const dateFormat = new Intl.DateTimeFormat('default', { weekday: 'short', hour: 'numeric', minute: 'numeric' });

function ChainHealth(props) {
  const { blockchain, timespan } = props;
  const [health, setHealth] = useState(false);
  useEffect(() => {
    setHealth(false);
    fetch(`${apiBaseUrl}/chain/${blockchain.chain}/health/${timespan.from.toISOString()}/${timespan.to.toISOString()}`)
      .then(response => response.json())
      .then(setHealth);
      //.catch(console.error);
  }, [blockchain, timespan]);
  return (
    <div style={{marginTop: '30px'}}>
      {
        (!!blockchain.tier)
          ? (
              <Link to={`/chain/${blockchain.relay}/${blockchain.name}`} style={{textDecoration: 'none', color: '#000000', cursor: 'pointer'}}>
                <h3>
                  <strong>{blockchain.name}</strong> <sup><em className="text-muted">{blockchain.relay}</em></sup>
                </h3>
                {
                  (!!health)
                    ? (
                        <p>
                          {
                            dateFormat.format(new Date(health.summary.from))
                          } - {
                            dateFormat.format(new Date(health.summary.to))
                          }
                        </p>
                      )
                    : null
                }
              </Link>
            )
          : (
              <Link to={`/chain/${blockchain.relay}/${blockchain.name}`} style={{textDecoration: 'none', color: '#000000', cursor: 'pointer'}}>
                <h3>
                  <strong>{blockchain.name}</strong>
                </h3>
                {
                  (!!health)
                    ? (
                        <p>
                          {
                            dateFormat.format(new Date(health.summary.from))
                          } - {
                            dateFormat.format(new Date(health.summary.to))
                          }
                        </p>
                      )
                    : null
                }
              </Link>
            )
      }
      {
        (!!health)
          ? health.chunks.map((chunk) => (
            <span key={chunk.from} title={`${chunk.from} - ${chunk.to}: ${chunk.healthy} / ${chunk.total} healthy observations`} style={{
              backgroundColor: `rgba(${
                ((chunk.healthy / chunk.total) > 0.666)
                  ? '105, 168, 100'
                  : ((chunk.healthy / chunk.total) > 0.333)
                    ? '233, 158, 24'
                    : '236, 0, 5'}, ${
                ((chunk.healthy / chunk.total) > 0.666)
                  ? (chunk.healthy / chunk.total)
                  : (1 - (chunk.healthy / chunk.total))})`,
              marginLeft: '0.5em',
              padding: '10px 4px',
            }}>&nbsp;</span>
            ))
          : (
              <Spinner animation="border" variant="secondary" size="sm">
                {
                  !!blockchain.tier
                    ? (
                        <span className="visually-hidden">{blockchain.name} <sup>{blockchain.relay}</sup> health lookup in progress...</span>
                      )
                    : (
                        <span className="visually-hidden">{blockchain.name} health lookup in progress...</span>
                      )
                }
              </Spinner>
            )
      }
    </div>
  );
}

export default ChainHealth;
