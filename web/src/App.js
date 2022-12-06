import { Fragment, useEffect, useState } from 'react';
import { RequireAuth } from 'react-auth-kit';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link
} from 'react-router-dom';
import { AuthProvider } from 'react-auth-kit';
import Container from 'react-bootstrap/Container';
import Navbar from 'react-bootstrap/Navbar';
import NavDropdown from 'react-bootstrap/NavDropdown';
import Nav from 'react-bootstrap/Nav';
import Dashboard from './Dashboard';
import Chain from './Chain';
import Platform from './Platform';
import Node from './Node';
import refreshApi from './refreshApi';
import AuthNav from './AuthNav';
import apiBaseUrl from './apiBaseUrl';


function App() {
  const [blockchains, setBlockchains] = useState([]);
  const [relays, setRelays] = useState([]);
  useEffect(() => {
    if (!blockchains.length) {
      fetch(`${apiBaseUrl}/blockchains`)
        .then(response => response.json())
        .then((container) => {
          if (!!container.error) {
            console.error(container.error);
          } else {
            setRelays([...new Set([
              ...container.blockchains.filter((b) => !!b.tier).map((b) => b.relay),
              ...container.blockchains.filter((b) => !b.tier).map((b) => b.name),
            ])].sort());
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
      <AuthProvider authType = {'cookie'} authName={'_auth'} refresh={refreshApi} cookieDomain={window.location.hostname} cookieSecure={window.location.protocol === "https:"}>
        <Router>
          <Navbar>
            <Navbar.Brand as={Link} to="/">rubberneck</Navbar.Brand>
            <Navbar.Toggle aria-controls="basic-navbar-nav" />
            <Navbar.Collapse>
              <Nav>
                {
                  relays.map((relay, rI) => (
                    <NavDropdown key={relay} title={relay}>
                      {
                        blockchains.filter((b) => (b.name === relay)).map((blockchain, bI) => (
                          <Fragment key={blockchain.name}>
                            <NavDropdown.Item as={Link} to={`/chain/${blockchain.name}`}>
                              <strong>{blockchain.name.replace('-testnet', 'ᵗ').replace('-internal', 'ᶤ')}</strong>
                            </NavDropdown.Item>
                            <NavDropdown.Divider />
                          </Fragment>
                        ))
                      }
                      {
                        blockchains.filter((b) => (b.relay === relay)).map((blockchain, bI) => (
                          <NavDropdown.Item key={blockchain.name} as={Link} to={`/chain/${blockchain.relay}/${blockchain.name}`}>
                            <strong>{blockchain.name.replace('-testnet', 'ᵗ').replace('-internal', 'ᶤ')}</strong> <sup><em className="text-muted">{blockchain.relay.replace('-testnet', 'ᵗ').replace('-internal', 'ᶤ')}</em></sup>
                          </NavDropdown.Item>
                        ))
                      }
                    </NavDropdown>
                  ))
                }
              </Nav>
              <AuthNav />
            </Navbar.Collapse>
          </Navbar>
          <Routes>
            <Route path='/' element={<Dashboard blockchains={blockchains} />} />
            <Route path='/chain/:relaychain/:parachain' element={<Chain />} />
            <Route path='/chain/:relaychain' element={<Chain />} />
            <Route path='/node/:fqdn' element={<Node />} />
            <Route path='/platform/:platform' element={<Platform />} />
            <Route path={'/secure'} element={
              <RequireAuth loginPath={'/login'}>
                <div>
                  secure
                </div>
              </RequireAuth>
            }/>
          </Routes>
        </Router>
      </AuthProvider>
    </Container>
  );
}

export default App;
