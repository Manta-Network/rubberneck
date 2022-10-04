import Col from 'react-bootstrap/Col';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import Popover from 'react-bootstrap/Popover';
import Row from 'react-bootstrap/Row';
import Table from 'react-bootstrap/Table';
import { dateDiff } from './utils';

function RunningCost(props) {
  const { node } = props;
  const hours = dateDiff(new Date(node.launch), null, 'hour');
  const cost = {
    hours,
    hourly: node.price.hour.amount,
    total: hours * node.price.hour.amount
  };
  const valueColumn = {
    style: {
      textAlign: 'right',
      fontWeight: 'bold'
    }
  };
  return (
    <OverlayTrigger placement="bottom" overlay={
      <Popover>
        <Popover.Header>
          <Row style={{fontWeight: 'bold'}}>
            <Col>{dateDiff(new Date(node.launch), null, 'significant')}</Col>
            <Col md={'auto'}>
              {new Intl.NumberFormat('en-US', { style: 'currency', minimumFractionDigits: 0, currency: node.price.hour.currency }).format(cost.total.toFixed())}
            </Col>
          </Row>
        </Popover.Header>
        <Popover.Body>
          <Table size="sm">
            <tbody>
              <tr>
                <td>machine</td>
                <td {...valueColumn}>
                  {node.machine}
                </td>
              </tr>
              <tr>
                <td>region</td>
                <td {...valueColumn}>
                  {node.region}
                </td>
              </tr>
              <tr>
                <td>launch</td>
                <td {...valueColumn}>
                  {new Intl.DateTimeFormat('default', { date: 'short' }).format(new Date(node.launch)).toLowerCase()}
                </td>
              </tr>
              <tr>
                <td>hourly</td>
                <td {...valueColumn}>
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: node.price.hour.currency }).format(node.price.hour.amount)}
                </td>
              </tr>
              <tr>
                <td>daily</td>
                <td {...valueColumn}>
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: node.price.hour.currency }).format(node.price.hour.amount * 24)}
                </td>
              </tr>
              <tr>
                <td>monthly</td>
                <td {...valueColumn}>
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: node.price.hour.currency }).format(node.price.hour.amount * 24 * 30)}
                </td>
              </tr>
              <tr>
                <td>running</td>
                <td {...valueColumn}>
                  {new Intl.NumberFormat('default').format(cost.hours)} hours
                </td>
              </tr>
              <tr>
                <td>total</td>
                <td {...valueColumn}>
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: node.price.hour.currency }).format(cost.total)}
                </td>
              </tr>
            </tbody>
          </Table>
        </Popover.Body>
      </Popover>
    }>
     <span>
       {dateDiff(new Date(node.launch), null, 'significant')}: {new Intl.NumberFormat('en-US', { style: 'currency', currency: node.price.hour.currency }).format(cost.total)}
     </span>
    </OverlayTrigger>
  );
}

export default RunningCost;
