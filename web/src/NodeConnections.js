import { useEffect, useState } from 'react';
import ProgressBar from 'react-bootstrap/ProgressBar';
import Spinner from 'react-bootstrap/Spinner';

const threshold = {
  danger: 0.85,
  warning: 0.66,
};

function NodeConnections(props) {
  const { fqdn } = props;
  const [connections, setConnections] = useState(0);
  const [wsMaxConnections, setWsMaxConnections] = useState(100);
  useEffect(() => {
    fetch(`https://pulse.pelagos.systems/api/v1/query?query=nginx_connections_active{instance%3D%22${fqdn}:443%22}`)
      .then(r => r.json())
      .then((container) => {
        if (!!container.data && !!container.data.result && !!container.data.result.length) {
          setConnections(container.data.result[0].value[1]);
        }
      })
      .catch(console.error);
  }, [fqdn]);
  useEffect(() => {
    const hostname = fqdn.split('.')[0];
    const domain = fqdn.split('.').slice(1).join('.');
    let unit;
    switch (domain) {
      case 'baikal.manta.systems':
        unit = 'baikal';
        break;
      case 'baikal.testnet.calamari.systems':
      case 'calamari.moonsea.systems':
      case 'calamari.seabird.systems':
      case 'calamari.systems':
        unit = 'calamari';
        break;
      case 'baikal.testnet.dolphin.training':
      case 'dolphin.engineering':
      case 'dolphin.seabird.systems':
        unit = 'dolphin';
        break;
      case 'acala.seabird.systems':
        unit = 'karura';
        break;
      case 'internal.kusama.systems':
        switch (hostname[0]) {
          case 'a':
            unit = 'kusama-0';
            break;
          default:
            unit = 'kusama0';
            break;
        }
        break;
      case 'manta.systems':
        unit = 'manta';
        break;
      case 'moonriver.seabird.systems':
        unit = 'moonriver';
        break;
      default:
        unit = 'calamari';
        break;
    }
    const unitPrefix = (domain === 'calamari.systems') ? 'usr/lib' : 'etc';
    fetch(`https://raw.githubusercontent.com/Manta-Network/rubberneck/main/config/${domain}/${hostname}/${unitPrefix}/systemd/system/${unit}.service`)
      .then(r => r.text())
      .then((unitContents) => {
        const regex = /ws-max-connections ([0-9]+) /;
        setWsMaxConnections((domain === 'internal.kusama.systems') ? (3 * unitContents.match(regex)[1]) : unitContents.match(regex)[1]);
      });
  }, [fqdn]);
  return (
    (!!connections)
      ? (
          <ProgressBar
            now={((connections / wsMaxConnections) * 100)}
            title={`connections: ${connections} / ${wsMaxConnections}`}
            variant={
              ((connections / wsMaxConnections) > threshold.danger)
                ? 'danger'
                : ((connections / wsMaxConnections) > threshold.warning)
                  ? 'warning'
                  : 'success'
            }
          />
        )
      : (
          <Spinner style={{...props.style}} animation="grow" size="sm" className="text-secondary">
            <span className="visually-hidden">tcp connection count lookup in progress</span>
          </Spinner>
        )
  );
}

export default NodeConnections;
