import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Spinner from 'react-bootstrap/Spinner';
import apiBaseUrl from './apiBaseUrl';
import ChunkSummary from './ChunkSummary';

const dateFormat = (timespan) => {
  const difference = (new Date(timespan.to).getTime() - new Date(timespan.from).getTime())
  return (difference >= (7 * 86400 * 1000))
    ? new Intl.DateTimeFormat('default', { month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric' })
    : new Intl.DateTimeFormat('default', { weekday: 'short', hour: 'numeric', minute: 'numeric' });
}

function ChainHealth(props) {
  const { blockchain, timespan } = props;
  const [health, setHealth] = useState(false);
  const [chunkSummary, setChunkSummary] = useState(false);
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
                            dateFormat(health.summary).format(new Date(health.summary.from)).toLowerCase()
                          } - {
                            dateFormat(health.summary).format(new Date(health.summary.to)).toLowerCase()
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
                            dateFormat(health.summary).format(new Date(health.summary.from)).toLowerCase()
                          } - {
                            dateFormat(health.summary).format(new Date(health.summary.to)).toLowerCase()
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
          ? (
              <>
                <ChunkSummary
                  show={!!chunkSummary}
                  chunk={{...chunkSummary}}
                  onHide={() => setChunkSummary(false)}
                />
                {
                  health.chunks.map((chunk, cI) => (
                    <span
                      key={chunk.from}
                      title={`${dateFormat(health.summary).format(new Date(chunk.from)).toLowerCase()} - ${dateFormat(health.summary).format(new Date(chunk.to)).toLowerCase()}: ${chunk.healthy} / ${chunk.total} healthy observations`}
                      onClick={() => setChunkSummary(chunk)}
                      style={{
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
                        cursor: 'pointer',
                      }}>
                      &nbsp;
                    </span>
                  ))
                }
              </>
            )
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
