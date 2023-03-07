import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import NodeHealth from './NodeHealth';
import NodeDiskUsage from './NodeDiskUsage';
import NodeOs from './NodeOs';
import NodeConnections from './NodeConnections';
import RunningCost from './RunningCost';
import badge from './badge';
import consoleLink from './consoleLink';

function NodeRow(props) {
  const { node } = props;
  const [dns, setDns] = useState({ loading: true });
  useEffect(() => {
    fetch(`https://cloudflare-dns.com/dns-query?name=${node.fqdn}`, { headers: { accept: 'application/dns-json' } })
      .then((response) => response.json())
      .then((cloudflare) => setDns((dns) => ({ ...dns, cloudflare, loading: false })));
    fetch(`https://dns.google/resolve?name=${node.fqdn}`, { headers: { accept: 'application/dns-json' } })
      .then((response) => response.json())
      .then((google) => setDns((dns) => ({ ...dns, google, loading: false })));
  }, [node.fqdn]);
  return (
    <tr>
      <td>
        <Link to={`/node/${node.fqdn}`} style={{textDecoration: 'none'}}>
          <strong>
            {node.hostname}
          </strong>
          <span className="text-muted">
            .{node.domain}
          </span>
        </Link>
      </td>
      {
        (!dns.loading && ((!!dns.google && !!dns.google.Status) || (!!dns.cloudflare && !!dns.cloudflare.Status)))
          ? (
              <td colspan="8">
                fqdn <em>{node.fqdn}</em> does not resolve to an ip address.
              </td>
            )
          : (
              <Fragment>
                <td>
                  <NodeHealth fqdn={node.fqdn} />
                  {
                    (!!node.metrics)
                      ? Object.entries(node.metrics).map(([name, target], tI) => {
                          const secondsSinceLastScrape = ((Date.now() - (new Date(target.lastScrape))) / 1000);
                          const scrapeInterval = parseInt(target.scrapeInterval.replace('s', ''));
                          const state = (secondsSinceLastScrape < scrapeInterval)
                            ? 'active'
                            : 'inactive';
                          const clue = (secondsSinceLastScrape < scrapeInterval)
                            ? 'text-success'
                            : (secondsSinceLastScrape < (scrapeInterval * 2))
                              ? 'text-warning'
                              : 'text-danger';
                          return (
                            <i key={tI} title={`${secondsSinceLastScrape} seconds since last ${name} metrics scrape`} className={`bi bi-${badge[name][state]} ${clue}`} style={{marginLeft: '0.5em'}} />
                          );
                        })
                      : (
                          <i title={`metrics unavailable`} className={`bi bi-exclamation text-danger`} />
                        )
                  }
                </td>
                <td>
                  <NodeOs fqdn={node.fqdn} />
                </td>
                <td>
                  <NodeDiskUsage fqdn={node.fqdn} />
                </td>
                <td>
                  <NodeConnections fqdn={node.fqdn} />
                </td>
                <td>
                  {
                    (!!node.roles && !!node.roles.length)
                      ? node.roles.map((role, rI) => (
                          <i key={rI} title={role} className={`bi bi-${badge[role]}`} />
                        ))
                      : null
                  }
                </td>
                <td>
                  {
                    (!!node.location && !!node.location.country && !!node.location.country.flag)
                      ? (
                          <span
                            title={`${node.region}: ${node.location.city.name}, ${node.location.country.name}`}>
                            {node.location.country.flag}
                          </span>
                        )
                      : <i className={`bi bi-geo`} title={(!!node.location && !!node.location.country)? node.location.country : node.region} />
                  }
                </td>
                <td>
                  {consoleLink(node)}
                </td>
                <td style={{ textAlign: 'right' }}>
                  <RunningCost node={node} />
                </td>
              </Fragment>
            )
      }
    </tr>
  );
}

export default NodeRow;
