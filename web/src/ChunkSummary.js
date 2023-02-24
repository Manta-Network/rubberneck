import Badge from 'react-bootstrap/Badge';
import Button from 'react-bootstrap/Button';
import Modal from 'react-bootstrap/Modal';

const dateFormat = new Intl.DateTimeFormat('default', { month: 'short', day: 'numeric', weekday: 'short', hour: 'numeric', minute: 'numeric' });

function ChunkSummary(props) {
  return (
    <Modal
      {...props}
      size="lg"
      aria-labelledby="contained-modal-title-vcenter"
      centered
    >
      {
        (!!props.chunk && !!props.chunk.observations)
          ? (
              <>
                <Modal.Header closeButton>
                  <Modal.Title id="contained-modal-title-vcenter">
                    peer and websocket observations
                  </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                  <h5>
                    {dateFormat.format(new Date(props.chunk.from)).toLowerCase()} - {dateFormat.format(new Date(props.chunk.to)).toLowerCase()}
                  </h5>
                  <ul>
                    {
                      props.chunk.observations.map((observation) => (
                        <li key={`${observation.observed}-${observation.fqdn}`}>
                          <a
                            style={{marginRight: '0.5em'}}
                            href={`https://${observation.fqdn}/${(observation.fqdn.endsWith('.internal.kusama.systems')) ? '0/health' : 'health'}`}>
                            <i title={`node health`} className={`bi bi-heart-pulse`} />
                          </a>
                          <a
                            style={{marginRight: '0.5em'}}
                            href={`https://polkadot.js.org/apps/?rpc=wss%3A%2F%2F${observation.fqdn}/${(observation.fqdn.endsWith('.internal.kusama.systems')) ? '/0' : ''}`}>
                            <i title={`polkadot.js`} className={`bi bi-plug`} />
                          </a>
                          <Badge
                            title={(!!observation.peers) ? `${observation.peers} connected peers` : 'no connected peers'}
                            bg={(!!observation.peers) ? 'success' : 'danger'}
                            style={{marginRight: '0.5em'}}>
                            {
                              (!!observation.peers)
                                ? observation.peers
                                : (
                                    <i title={`no connected peers`} className={`bi bi-heartbreak`} />
                                  )
                            }
                          </Badge>
                          {dateFormat.format(new Date(observation.observed)).toLowerCase()} {observation.fqdn}
                        </li>
                      ))
                    }
                  </ul>
                </Modal.Body>
                <Modal.Footer>
                  <Button onClick={props.onHide}>close</Button>
                </Modal.Footer>
              </>
            )
          : null
      }
    </Modal>
  );
}

export default ChunkSummary;
