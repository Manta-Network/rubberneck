import { useEffect, useState } from 'react';
import Badge from 'react-bootstrap/Badge';
import Spinner from 'react-bootstrap/Spinner';
import { ApiPromise, WsProvider } from '@polkadot/api';

const websocket = {
  baikal: {
    'calamari-testnet': 'wss://tasty.baikal.testnet.calamari.systems',
    relay: 'wss://arangatuy.baikal.manta.systems',
  },
  kusama: {
    calamari: 'wss://ws.calamari.systems',
    dolphin: 'wss://prosser.dolphin.community',
  },
  rococo: {
    dolphin: 'wss://ws.rococo.dolphin.engineering',
  },
  polkadot: {
    manta: 'wss://rochebrunei.manta.systems',
  },
};

function ChainHead(props) {
  const { parachain, relaychain, url } = props;
  const [head, setHead] = useState(undefined);
  useEffect(() => {
    let unsub;
    if (!!url && !!relaychain) {
      console.log({parachain, relaychain, url})
      const provider = new WsProvider((!!url) ? url : (!!parachain) ? websocket[relaychain][parachain] : websocket[relaychain].relay);
      new ApiPromise({ provider }).isReady.then((api) => {
        api.rpc.chain.subscribeNewHeads((header) => {
          setHead(header.number.toNumber());
        }).then((unsubscribe) => {
          unsub = unsubscribe;
          setTimeout(() => {
            unsubscribe();
          }, 10000);
        });
      }).catch((error) => {
        console.error(error);
        if (!!unsub) {
          unsub();
        }
      });
      /*
      ApiPromise.create({provider}).then((api) => {
        let count = 0;
        api.rpc.chain.subscribeNewHeads((header) => {
          setHead(header.number.toNumber());
        }).then((unsubscribe) => {
          if (++count >= 3) {
            unsubscribe();
          } else {
            unsub = unsubscribe;
          }
        });
      });
      */
    }
    return () => {
      if (!!unsub) {
        unsub();
      }
    }
  }, [ parachain, relaychain, url ]);
  return (
    <Badge pill bg="secondary" style={{marginLeft: '0.5em'}}>
      {
        (head === undefined)
          ? (
              <Spinner animation="border" size="sm" />
            )
          : new Intl.NumberFormat('default').format(head)
      }
    </Badge>
  );
}

export default ChainHead;
