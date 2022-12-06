import {
  useAuthUser,
  useIsAuthenticated,
  useSignIn,
  useSignOut,
} from 'react-auth-kit';
import NavDropdown from 'react-bootstrap/NavDropdown';
import Nav from 'react-bootstrap/Nav';

const AuthNav = () => {
  const isAuthenticated = useIsAuthenticated();
  const signIn = useSignIn();
  const signOut = useSignOut();
  const auth = useAuthUser();
  const signInHandler = (e) => {
    if (signIn(
      /*{
        token: res.data.token,
        expiresIn:res.data.expiresIn,
        tokenType: 'Bearer',
        authState: res.data.authUserState,
        refreshToken: res.data.refreshToken,          // if using refreshToken feature
        refreshTokenExpireIn: res.data.refreshTokenExpireIn   // if using refreshToken feature
      }
      */
    )) {
      // Redirect or do-something
    } else {
      //Throw error
    }
  };
  const signOutHandler = (e) => {
    if (signOut()) {
      // Redirect or do-something
    } else {
      //Throw error
    }
  };

  return (
    <Nav className="ms-auto">
      {
        isAuthenticated()
          ? (
              <NavDropdown title={auth().user}>
                <NavDropdown.Item onClick={signOutHandler}>
                  sign out
                </NavDropdown.Item>
              </NavDropdown>
            )
          : (
              <Nav.Link onClick={signInHandler}>
                sign in
              </Nav.Link>
            )
      }
    </Nav>
    
  );
}

export default AuthNav;
