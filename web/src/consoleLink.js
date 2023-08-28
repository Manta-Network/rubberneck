import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ReactComponent as ShockLogo } from './shock.svg';
import { ReactComponent as S4yLogo } from './s4y.svg';
import { ReactComponent as GcpLogo } from './gcp.svg';
import { faAws } from '@fortawesome/free-brands-svg-icons'
import { faH } from '@fortawesome/free-solid-svg-icons';

const consoleLink = (node) => {
  if (!node.console) {
    return null;
  }
  switch (node.provider) {
    case 'amazon-ec2':
      return (
        <a href={node.console.url}>
          <span style={{marginRight: '0.3em', color: 'rgb(255, 153, 0)', padding: '0 0.2em'}}>
            <FontAwesomeIcon icon={faAws} />
          </span>
          {node.console.text.toLowerCase()}
        </a>
      );
    case 'google-cloud':
      return (
        <a href={node.console.url}>
          <GcpLogo style={{width: '20px', height: '20px', marginRight: '5px'}} />
          {node.console.text.toLowerCase()}
        </a>
      );
    case 'hetzner-cloud':
      return (
        <a href={node.console.url}>
          <span style={{marginRight: '0.3em', backgroundColor: 'red', color: 'white', padding: '0 0.2em'}}>
            <FontAwesomeIcon icon={faH} />
          </span>
          {node.console.text.toLowerCase()}
        </a>
      );
    case 'hetzner-robot':
      return (
        <a href={node.console.url}>
          <span style={{marginRight: '0.3em', backgroundColor: 'red', color: 'white', padding: '0 0.2em'}}>
            <FontAwesomeIcon icon={faH} />
          </span>
          {node.console.text.toLowerCase()}
        </a>
      );
    case 's4y-dedicated':
      return (
        <a href={node.console.url}>
          <S4yLogo style={{width: '20px', height: '20px', marginRight: '5px'}} />
          {node.console.text.toLowerCase()}
        </a>
      );
    case 'shock-dedicated':
      return (
        <a href={node.console.url}>
          <ShockLogo style={{width: '20px', height: '20px', marginRight: '5px'}} />
          {node.console.text.toLowerCase()}
        </a>
      );
    default:
      return null;
  }
};

export default consoleLink;
