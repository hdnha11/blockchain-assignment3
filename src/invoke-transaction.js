const util = require('util');

const helper = require('./helper.js');
const logger = helper.getLogger('Invoke-Chaincode');

const invokeChaincode = async (
  peerNames,
  channelName,
  chaincodeName,
  fcn,
  args,
  username,
  orgName,
) => {
  logger.debug(util.format('Invoke transaction on channel %s', channelName));
  let errorMessage = null;
  let txIdString = null;
  try {
    // first setup the client for this org
    const client = await helper.getClientForOrg(orgName, username);
    logger.debug(
      'Successfully got the fabric client for the organization "%s"',
      orgName,
    );
    const channel = client.getChannel(channelName);
    if (!channel) {
      const message = util.format(
        'Channel %s was not defined in the connection profile',
        channelName,
      );
      logger.error(message);
      throw new Error(message);
    }
    const txId = client.newTransactionID();
    // will need the transaction ID string for the event registration later
    txIdString = txId.getTransactionID();

    // send proposal to endorser
    const request = {
      targets: peerNames,
      chaincodeId: chaincodeName,
      fcn,
      args,
      chainId: channelName,
      txId,
    };

    const results = await channel.sendTransactionProposal(request);

    // the returned object has both the endorsement results
    // and the actual proposal, the proposal will be needed
    // later when we send a transaction to the orderer
    const [proposalResponses, proposal] = results;

    // lets have a look at the responses to see if they are
    // all good, if good they will also include signatures
    // required to be committed
    let allGood = true;
    for (let i in proposalResponses) {
      let oneGood = false;
      if (
        proposalResponses &&
        proposalResponses[i].response &&
        proposalResponses[i].response.status === 200
      ) {
        oneGood = true;
        logger.info('invoke chaincode proposal was good');
      } else {
        logger.error('invoke chaincode proposal was bad');
      }
      allGood = allGood & oneGood;
    }

    if (allGood) {
      logger.info(
        util.format(
          'Successfully sent Proposal and received ProposalResponse: Status - %s, message - "%s", metadata - "%s", endorsement signature: %s',
          proposalResponses[0].response.status,
          proposalResponses[0].response.message,
          proposalResponses[0].response.payload,
          proposalResponses[0].endorsement.signature,
        ),
      );

      // wait for the channel-based event hub to tell us
      // that the commit was good or bad on each peer in our organization
      const promises = [];
      const eventHubs = channel.getChannelEventHubsForOrg();
      eventHubs.forEach(eh => {
        logger.debug('invokeEventPromise - setting up event');
        const invokeEventPromise = new Promise((resolve, reject) => {
          const eventTimeout = setTimeout(() => {
            const message = 'REQUEST_TIMEOUT:' + eh.getPeerAddr();
            logger.error(message);
            eh.disconnect();
          }, 3000);
          eh.registerTxEvent(
            txIdString,
            (tx, code, blockNum) => {
              logger.info(
                'The chaincode invoke chaincode transaction has been committed on peer %s',
                eh.getPeerAddr(),
              );
              logger.info(
                'Transaction %s has status of %s in blocl %s',
                tx,
                code,
                blockNum,
              );
              clearTimeout(eventTimeout);

              if (code !== 'VALID') {
                const message = util.format(
                  'The invoke chaincode transaction was invalid, code:%s',
                  code,
                );
                logger.error(message);
                reject(new Error(message));
              } else {
                const message = 'The invoke chaincode transaction was valid.';
                logger.info(message);
                resolve(message);
              }
            },
            err => {
              clearTimeout(eventTimeout);
              logger.error(err);
              reject(err);
            },
            // the default for 'unregister' is true for transaction listeners
            // so no real need to set here, however for 'disconnect'
            // the default is false as most event hubs are long running
            // in this use case we are using it only once
            {unregister: true, disconnect: true},
          );
          eh.connect();
        });
        promises.push(invokeEventPromise);
      });

      const ordererRequest = {
        txId,
        proposalResponses,
        proposal,
      };
      const sendPromise = channel.sendTransaction(ordererRequest);
      // put the send to the orderer last so that the events get registered and
      // are ready for the orderering and committing
      promises.push(sendPromise);
      const results = await Promise.all(promises);
      logger.debug(util.format('RESPONSE: %j', results));
      const response = results.pop(); //  orderer results are last in the results
      if (response.status === 'SUCCESS') {
        logger.info('Successfully sent transaction to the orderer.');
      } else {
        errorMessage = util.format(
          'Failed to order the transaction. Error code: %s',
          response.status,
        );
        logger.debug(errorMessage);
      }

      // now see what each of the event hubs reported
      for (let i in results) {
        const eventHubResult = results[i];
        const eventHub = eventHubs[i];
        logger.debug('Event results for event hub :%s', eventHub.getPeerAddr());
        if (typeof eventHubResult === 'string') {
          logger.debug(eventHubResult);
        } else {
          if (!errorMessage) errorMessage = eventHubResult.toString();
          logger.debug(eventHubResult.toString());
        }
      }
    } else {
      errorMessage = util.format(
        'Failed to send Proposal and receive all good ProposalResponse',
      );
      logger.debug(errorMessage);
    }
  } catch (error) {
    logger.error(
      'Failed to invoke due to error: ' + error.stack ? error.stack : error,
    );
    errorMessage = error.toString();
  }

  if (!errorMessage) {
    const message = util.format(
      "Successfully invoked the chaincode %s to the channel '%s' for transaction ID: %s",
      orgName,
      channelName,
      txIdString,
    );
    logger.info(message);

    return txIdString;
  } else {
    const message = util.format(
      'Failed to invoke chaincode. cause:%s',
      errorMessage,
    );
    logger.error(message);
    throw new Error(message);
  }
};

exports.invokeChaincode = invokeChaincode;
