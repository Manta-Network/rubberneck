import { Fragment, useEffect, useState } from 'react';
import Spinner from 'react-bootstrap/Spinner';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCentos,
  faFedora,
  faLinux,
  faRedhat,
  faSuse,
  faUbuntu
} from '@fortawesome/free-brands-svg-icons';

const versionClassname = (os) => {
  switch (os.distribution) {
    case 'ubuntu':
      switch (os.version.id) {
        case '22.04':
          return 'success';
        case '20.04':
          return 'warning';
        default:
          return 'danger';
      }
    case 'fedora':
      switch (os.version.id) {
        case '37':
          return 'success';
        case '36':
          return 'warning';
        default:
          return 'danger';
      }
    default:
      return 'warning';
  }
};

const osIcon = (os) => {
  switch (os.distribution) {
    case 'centos':
      return (<FontAwesomeIcon icon={faCentos} title={`${os.name} - ${os.version.name}`} className={`text-${versionClassname(os)}`} />);
    case 'fedora':
      return (<FontAwesomeIcon icon={faFedora} title={`${os.name} - ${os.version.name}`} className={`text-${versionClassname(os)}`} />);
    case 'redhat':
      return (<FontAwesomeIcon icon={faRedhat} title={`${os.name} - ${os.version.name}`} className={`text-${versionClassname(os)}`} />);
    case 'suse':
      return (<FontAwesomeIcon icon={faSuse} title={`${os.name} - ${os.version.name}`} className={`text-${versionClassname(os)}`} />);
    case 'ubuntu':
      return (<FontAwesomeIcon icon={faUbuntu} title={`${os.name} - ${os.version.name}`} className={`text-${versionClassname(os)}`} />);
    default:
      return (<FontAwesomeIcon icon={faLinux} title={`${os.name} - ${os.version.name}`} className={`text-${versionClassname(os)}`} />);
  }
};

function NodeTcp(props) {
  const { fqdn } = props;
  const [os, setOs] = useState(undefined);
  const [uname, setUname] = useState(undefined);
  useEffect(() => {
    fetch(`https://pulse.pelagos.systems/api/v1/query?query=node_os_info{instance%3D%22${fqdn}:443%22}`)
      .then(r => r.json())
      .then((container) => {
        if (!!container.data && !!container.data.result && !!container.data.result.length) {
          setOs({
            distribution: container.data.result[0].metric.id,
            family: container.data.result[0].metric.id_like,
            name: container.data.result[0].metric.pretty_name,
            version: {
              id: container.data.result[0].metric.version_id,
              codename: container.data.result[0].metric.version_codename,
              name: container.data.result[0].metric.version,
            },
          });
        }
      })
      .catch(console.error);
  }, [fqdn]);
  useEffect(() => {
    fetch(`https://pulse.pelagos.systems/api/v1/query?query=node_uname_info{instance%3D%22${fqdn}:443%22}`)
      .then(r => r.json())
      .then((container) => {
          const { release, sysname, version } = container.data.result[0].metric;
          setUname({release, sysname, version});
      })
      .catch(console.error);
  }, [fqdn]);
  return (
    <Fragment>
      {
        (!!os)
          ? osIcon(os)
          : (
              <Spinner style={{...props.style}} animation="grow" size="sm" className="text-secondary">
                <span className="visually-hidden">operating system lookup in progress</span>
              </Spinner>
            )
      }
      {
        (!!uname)
          ? (
              <FontAwesomeIcon icon={faLinux} title={`${uname.release} - ${uname.sysname} - ${uname.version}`} style={{ marginLeft: '0.5em'}} />
            )
          : (
              <Spinner style={{...props.style}} animation="grow" size="sm" className="text-secondary">
                <span className="visually-hidden">kernel version lookup in progress</span>
              </Spinner>
            )
      }
    </Fragment>
  );
}

export default NodeTcp;
