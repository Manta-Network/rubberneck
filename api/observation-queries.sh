mongosh --quiet --eval '
  config.set("displayBatchSize", 300);
  db.observation.aggregate(
    {
      $match: {
        fqdn: "jalapeno.calamari.systems",
        observed: {
          $gt: new Date("2022-07-05T09:00:00.000Z"),
          $lt: new Date("2022-07-06T12:00:00.000Z")
        }
      }
    },
    {
      $project: {
        _id: false,
        observed: true,
        cert_validity_days: { $trunc: { $divide: [{ $subtract: ["$cert.expiry", "$observed"] }, 1000 * 60 * 60 * 24] } },
        peers_connected: { $cond: [{ $not: ["$node.peers"] }, 0, "$node.peers"] },
        websocket_redponsive: { $cond: [{ $not: ["$node.id"] }, false, true] }
      }
    }
  ).toArray()
' ${mongo_connection}

# { $cond: { if: { $gte: [ "$observed", "$cert.expiry" ] }, then: false, else: true } }
