import { useParams } from 'react-router-dom';
import Aws from './Aws';
import Hetzner from './Hetzner';

function Platform(props) {
  const { platform } = useParams();
  return (
    (platform === 'hetzner')
      ? <Hetzner />
      : <Aws />
  );
}

export default Platform;
