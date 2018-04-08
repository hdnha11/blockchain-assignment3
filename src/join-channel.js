const util = require('util');

const helper = require('./helper.js');
const logger = helper.getLogger('Join-Channel');

/*
 * Have an organization join a channel
 */
const joinChannel = async (channelName, peers, username, orgName) => {
  logger.debug('Join Channel start');
  let errorMessage = null;
  const allEventHubs = [];
  try {
    logger.info(
      'Calling peers in organization "%s" to join the channel',
      orgName,
    );

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

    // next step is to get the genesisBlock from the orderer,
    // the starting point for the channel that we want to join
    const request = {
      txId: client.newTransactionID(true), // get an admin based transactionID
    };
    const genesisBlock = await channel.getGenesisBlock(request);

    // tell each peer to join and wait for the event hub of each peer to tell us
    // that the channel has been created on each peer
    const promises = [];
    const blockRegistrationNumbers = [];
    const eventHubs = client.getEventHubsForOrg(orgName);
    eventHubs.forEach(eh => {
      const configBlockPromise = new Promise((resolve, reject) => {
        const eventTimeout = setTimeout(() => {
          const message = 'REQUEST_TIMEOUT:' + eh._ep._endpoint.addr;
          logger.error(message);
          eh.disconnect();
          reject(new Error(message));
        }, 60000);
        const blockRegistrationNumber = eh.registerBlockEvent(
          block => {
            clearTimeout(eventTimeout);
            // a peer may have more than one channel so
            // we must check that this block came from the channel we
            // asked the peer to join
            if (block.data.data.length === 1) {
              // Config block must only contain one transaction
              const channelHeader =
                block.data.data[0].payload.header.channel_header;
              if (channelHeader.channel_id === channelName) {
                const message = util.format(
                  'EventHub % has reported a block update for channel %s',
                  eh._ep._endpoint.addr,
                  channelName,
                );
                logger.info(message);
                resolve(message);
              } else {
                const message = util.format(
                  'Unknown channel block event received from %s',
                  eh._ep._endpoint.addr,
                );
                logger.error(message);
                reject(new Error(message));
              }
            }
          },
          err => {
            clearTimeout(eventTimeout);
            const message =
              'Problem setting up the event hub :' + err.toString();
            logger.error(message);
            reject(new Error(message));
          },
        );
        // save the registration handle so able to deregister
        blockRegistrationNumbers.push(blockRegistrationNumber);
        allEventHubs.push(eh); //save for later so that we can shut it down
      });
      promises.push(configBlockPromise);
      eh.connect(); //this opens the event stream that must be shutdown at some point with a disconnect()
    });

    const joinRequest = {
      targets: peers, //using the peer names which only is allowed when a connection profile is loaded
      txId: client.newTransactionID(true), //get an admin based transactionID
      block: genesisBlock,
    };
    const joinPromise = channel.joinChannel(joinRequest);
    promises.push(joinPromise);
    const results = await Promise.all(promises);
    logger.debug(util.format('Join Channel RESPONSE: %j', results));

    // lets check the results of sending to the peers which is
    // last in the results array
    const peersResults = results.pop();
    // then each peer results
    for (let i in peersResults) {
      const peerResult = peersResults[i];
      if (peerResult.response && peerResult.response.status == 200) {
        logger.info('Successfully joined peer to the channel %s', channelName);
      } else {
        const message = util.format(
          'Failed to joined peer to the channel %s',
          channelName,
        );
        errorMessage = message;
        logger.error(message);
      }
    }
    // now see what each of the event hubs reported
    for (let i in results) {
      const eventHubResult = results[i];
      const eventHub = eventHubs[i];
      const blockRegistrationNumber = blockRegistrationNumbers[i];
      logger.debug(
        'Event results for event hub :%s',
        eventHub._ep._endpoint.addr,
      );
      if (typeof eventHubResult === 'string') {
        logger.debug(eventHubResult);
      } else {
        if (!errorMessage) errorMessage = eventHubResult.toString();
        logger.debug(eventHubResult.toString());
      }
      eventHub.unregisterBlockEvent(blockRegistrationNumber);
    }
  } catch (error) {
    logger.error(
      'Failed to join channel due to error: ' + error.stack
        ? error.stack
        : error,
    );
    errorMessage = error.toString();
  }

  // need to shutdown open event streams
  allEventHubs.forEach(eh => {
    eh.disconnect();
  });

  if (!errorMessage) {
    const message = util.format(
      'Successfully joined peers in organization %s to the channel:%s',
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
      'Failed to join all peers to channel. cause:%s',
      errorMessage,
    );
    logger.error(message);
    throw new Error(message);
  }
};

exports.joinChannel = joinChannel;
