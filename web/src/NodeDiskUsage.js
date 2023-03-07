import { useEffect, useState } from 'react';
import ProgressBar from 'react-bootstrap/ProgressBar';
import Spinner from 'react-bootstrap/Spinner';

const threshold = {
  danger: 0.85,
  warning: 0.66,
};

function NodeDiskUsage(props) {
  const { fqdn } = props;
  const [disk, setDisk] = useState({ size: 0, available: 0 });
  useEffect(() => {
    fetch(`https://pulse.pelagos.systems/api/v1/query?query=node_filesystem_size_bytes{instance%3D%22${fqdn}:443%22}`)
      .then(r => r.json())
      .then((container) => {
        if (!!container.data.result) {
          const size = (container.data.result.some((r) => r.metric.mountpoint === '/data'))
            ? container.data.result.find((r) => r.metric.mountpoint === '/data').value[1]
            : container.data.result.find((r) => r.metric.mountpoint === '/').value[1];
          setDisk((d) => ({
            ...d,
            size,
          }));
        }
      })
      .catch(console.error);
    fetch(`https://pulse.pelagos.systems/api/v1/query?query=node_filesystem_avail_bytes{instance%3D%22${fqdn}:443%22}`)
      .then(r => r.json())
      .then((container) => {
        const available = (container.data.result.some((r) => r.metric.mountpoint === '/data'))
          ? container.data.result.find((r) => r.metric.mountpoint === '/data').value[1]
          : container.data.result.find((r) => r.metric.mountpoint === '/').value[1];
        setDisk((d) => ({
          ...d,
          available,
        }));
      })
      .catch(console.error);
  }, [fqdn]);
  return (
    (!!disk.size && !!disk.available)
      ? (
          <ProgressBar
            now={(((disk.size - disk.available) / disk.size) * 100)}
            title={`used: ${Math.round((disk.size - disk.available) / Math.pow(1024, 3))} gb, available: ${Math.round(disk.available / Math.pow(1024, 3))} gb, size: ${Math.round(disk.size / Math.pow(1024, 3))} gb`}
            variant={
              (((disk.size - disk.available) / disk.size) > threshold.danger)
                ? 'danger'
                : (((disk.size - disk.available) / disk.size) > threshold.warning)
                  ? 'warning'
                  : 'success'
            }
          />
        )
      : (
          <Spinner style={{...props.style}} animation="grow" size="sm" className="text-secondary">
            <span className="visually-hidden">node disk usage lookup in progress</span>
          </Spinner>
        )
  );
}

export default NodeDiskUsage;
