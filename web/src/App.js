import { useEffect, useState } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link
} from 'react-router-dom';
import Container from 'react-bootstrap/Container';
import Navbar from 'react-bootstrap/Navbar';
import Nav from 'react-bootstrap/Nav';
import Dashboard from './Dashboard';
import Chain from './Chain';
import Platform from './Platform';
import Node from './Node';


function App() {
  const [blockchains, setBlockchains] = useState([]);
  useEffect(() => {
    if (!blockchains.length) {
      fetch(`https://5eklk8knsd.execute-api.eu-central-1.amazonaws.com/prod/blockchains`)
        .then(response => response.json())
        .then((container) => {
          if (!!container.error) {
            console.error(container.error);
          } else {
            setBlockchains(container.blockchains);
          }
        })
        .catch((error) => {
          console.error(error);
        });
    }
  }, [blockchains.length]);

  return (
    <Container>
      <Router>
        <Navbar>
          <Navbar.Brand as={Link} to="/">rubberneck</Navbar.Brand>
          <Navbar.Toggle aria-controls="basic-navbar-nav" />
          <Navbar.Collapse id="basic-navbar-nav">
            <Nav className="ms-auto">
              {
                blockchains.map((blockchain, bI) => (
                  (blockchain.tier === 'parachain')
                    ? (
                        <Nav.Link key={bI} as={Link} to={`/chain/${blockchain.relay}/${blockchain.name}`}>
                          <strong>{blockchain.name.replace('-testnet', 'ᵗ').replace('-internal', 'ᶤ')}</strong> <sup><em className="text-muted">{blockchain.relay.replace('-testnet', 'ᵗ').replace('-internal', 'ᶤ')}</em></sup>
                        </Nav.Link>
                      )
                    : (
                        <Nav.Link key={bI} as={Link} to={`/chain/${blockchain.name}`}>
                          <strong>{blockchain.name.replace('-testnet', 'ᵗ').replace('-internal', 'ᶤ')}</strong>
                        </Nav.Link>
                      )
                ))
              }
            </Nav>
          </Navbar.Collapse>
        </Navbar>
        <Routes>
          <Route path='/' element={<Dashboard/>} />
          <Route path='/chain/:relaychain/:parachain' element={<Chain />} />
          <Route path='/chain/:relaychain' element={<Chain />} />
          <Route path='/node/:fqdn' element={<Node />} />
          <Route path='/platform/:platform' element={<Platform />} />
        </Routes>
      </Router>
    </Container>
  );
}

export default App;
