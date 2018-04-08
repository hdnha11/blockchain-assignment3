const util = require('util');

const helper = require('./helper.js');
const logger = helper.getLogger('Instantiate-Chaincode');

const instantiateChaincode = async (
  peers,
  channelName,
  chaincodeName,
  chaincodeVersion,
  functionName,
  chaincodeType,
  args,
  username,
  orgName,
) => {
  logger.debug(`Instantiate chaincode on channel ${channelName}`);
  let errorMessage = null;

  try {
    // first setup the client for this org
    const client = await helper.getClientForOrg(orgName, username);
    logger.debug(
      'Successfully got the fabric client for the organization "%s"',
      orgName,
    );
    const channel = client.getChannel(channelName);
    if (!channel) {
      let message = util.format(
        'Channel %s was not defined in the connection profile',
        channelName,
      );
      logger.error(message);
      throw new Error(message);
    }
    const txId = client.newTransactionID(true); // Get an admin based transactionID
    // An admin based transactionID will
    // indicate that admin identity should
    // be used to sign the proposal request.
    // will need the transaction ID string for the event registration later
    const deployId = txId.getTransactionID();

    // send proposal to endorser
    const request = {
      targets: peers,
      chaincodeId: chaincodeName,
      chaincodeType,
      chaincodeVersion,
      args,
      txId,
    };

    if (functionName) request.fcn = functionName;

    const results = await channel.sendInstantiateProposal(request, 60000); // instantiate takes much longer

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
        logger.info('instantiate proposal was good');
      } else {
        logger.error('instantiate proposal was bad');
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

      // wait for the channel-based event hub to tell us that the
      // instantiate transaction was committed on the peer
      const promises = [];
      let eventHubs = channel.getChannelEventHubsForOrg();
      logger.debug(
        'found %s eventhubs for this organization %s',
        eventHubs.length,
        orgName,
      );
      eventHubs.forEach(eh => {
        const instantiateEventPromise = new Promise((resolve, reject) => {
          logger.debug('instantiateEventPromise - setting up event');
          const eventTimeout = setTimeout(() => {
            const message = 'REQUEST_TIMEOUT:' + eh.getPeerAddr();
            logger.error(message);
            eh.disconnect();
          }, 60000);
          eh.registerTxEvent(
            deployId,
            (tx, code, blockNum) => {
              logger.info(
                'The chaincode instantiate transaction has been committed on peer %s',
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
                const message = until.format(
                  'The chaincode instantiate transaction was invalid, code:%s',
                  code,
                );
                logger.error(message);
                reject(new Error(message));
              } else {
                const message =
                  'The chaincode instantiate transaction was valid.';
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
        promises.push(instantiateEventPromise);
      });

      const ordererRequest = {
        txId, // must include the transaction id so that the outbound
        // transaction to the orderer will be signed by the admin
        // id as was the proposal above, notice that transactionID
        // generated above was based on the admin id not the current
        // user assigned to the 'client' instance.
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
        let eventHubResult = results[i];
        let eventHub = eventHubs[i];
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
      'Failed to send instantiate due to error: ' + error.stack
        ? error.stack
        : error,
    );
    errorMessage = error.toString();
  }

  if (!errorMessage) {
    const message = util.format(
      "Successfully instantiate chaingcode in organization %s to the channel '%s'",
      orgName,
      channelName,
    );
    logger.info(message);
    // build a response to send back to the REST caller
    const response = {
      success: true,
      message,
    };
    return response;
  } else {
    const message = util.format(
      'Failed to instantiate. cause:%s',
      errorMessage,
    );
    logger.error(message);
    throw new Error(message);
  }
};

exports.instantiateChaincode = instantiateChaincode;
