const util = require('util');

const helper = require('./helper.js');
const logger = helper.getLogger('Query');

const queryChaincode = async (
  peer,
  channelName,
  chaincodeName,
  args,
  fcn,
  username,
  orgName,
) => {
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

    // send query
    const request = {
      targets: [peer], // queryByChaincode allows for multiple targets
      chaincodeId: chaincodeName,
      fcn,
      args,
    };
    const responsePayloads = await channel.queryByChaincode(request);
    if (responsePayloads) {
      const [response] = responsePayloads.map(payload =>
        payload.toString('utf8'),
      );
      logger.info(response);
      return JSON.parse(response);
    } else {
      logger.error('responsePayloads is null');
      return null;
    }
  } catch (error) {
    logger.error(
      'Failed to query due to error: ' + error.stack ? error.stack : error,
    );
    return error.toString();
  }
};

const getBlockByNumber = async (
  peer,
  channelName,
  blockNumber,
  username,
  orgName,
) => {
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

    const responsePayload = await channel.queryBlock(
      parseInt(blockNumber, peer),
    );
    if (responsePayload) {
      logger.debug(responsePayload);
      return responsePayload;
    } else {
      logger.error('responsePayload is null');
      return 'responsePayload is null';
    }
  } catch (error) {
    logger.error(
      'Failed to query due to error: ' + error.stack ? error.stack : error,
    );
    return error.toString();
  }
};

const getTransactionByID = async (
  peer,
  channelName,
  trxnID,
  username,
  orgName,
) => {
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

    const responsePayload = await channel.queryTransaction(trxnID, peer);
    if (responsePayload) {
      logger.debug(responsePayload);
      return responsePayload;
    } else {
      logger.error('responsePayload is null');
      return 'responsePayload is null';
    }
  } catch (error) {
    logger.error(
      'Failed to query due to error: ' + error.stack ? error.stack : error,
    );
    return error.toString();
  }
};

const getBlockByHash = async (peer, channelName, hash, username, orgName) => {
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

    const responsePayload = await channel.queryBlockByHash(
      Buffer.from(hash),
      peer,
    );
    if (responsePayload) {
      logger.debug(responsePayload);
      return responsePayload;
    } else {
      logger.error('responsePayload is null');
      return 'responsePayload is null';
    }
  } catch (error) {
    logger.error(
      'Failed to query due to error: ' + error.stack ? error.stack : error,
    );
    return error.toString();
  }
};

const getChainInfo = async (peer, channelName, username, orgName) => {
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

    const responsePayload = await channel.queryInfo(peer);
    if (responsePayload) {
      logger.debug(responsePayload);
      return responsePayload;
    } else {
      logger.error('responsePayload is null');
      return 'responsePayload is null';
    }
  } catch (error) {
    logger.error(
      'Failed to query due to error: ' + error.stack ? error.stack : error,
    );
    return error.toString();
  }
};

const getInstalledChaincodes = async (
  peer,
  channelName,
  type,
  username,
  orgName,
) => {
  try {
    // first setup the client for this org
    const client = await helper.getClientForOrg(orgName, username);
    logger.debug(
      'Successfully got the fabric client for the organization "%s"',
      orgName,
    );

    let response = null;
    if (type === 'installed') {
      response = await client.queryInstalledChaincodes(peer, true); //use the admin identity
    } else {
      const channel = client.getChannel(channelName);
      if (!channel) {
        const message = util.format(
          'Channel %s was not defined in the connection profile',
          channelName,
        );
        logger.error(message);
        throw new Error(message);
      }
      response = await channel.queryInstantiatedChaincodes(peer, true); //use the admin identity
    }
    if (response) {
      if (type === 'installed') {
        logger.debug('<<< Installed Chaincodes >>>');
      } else {
        logger.debug('<<< Instantiated Chaincodes >>>');
      }
      const details = [];
      for (let i = 0; i < response.chaincodes.length; i++) {
        logger.debug(
          `name: ${response.chaincodes[i].name}, version: ${
            response.chaincodes[i].version
          }, path:  ${response.chaincodes[i].path}`,
        );
        details.push(
          `name: ${response.chaincodes[i].name}, version: ${
            response.chaincodes[i].version
          }, path:  ${response.chaincodes[i].path}`,
        );
      }
      return details;
    } else {
      logger.error('response is null');
      return 'response is null';
    }
  } catch (error) {
    logger.error(
      'Failed to query due to error: ' + error.stack ? error.stack : error,
    );
    return error.toString();
  }
};

const getChannels = async (peer, username, orgName) => {
  try {
    // first setup the client for this org
    const client = await helper.getClientForOrg(orgName, username);
    logger.debug(
      'Successfully got the fabric client for the organization "%s"',
      orgName,
    );

    const response = await client.queryChannels(peer);
    if (response) {
      logger.debug('<<< channels >>>');
      const channelNames = [];
      for (let i = 0; i < response.channels.length; i++) {
        channelNames.push(`channel id: ${response.channels[i].channel_id}`);
      }
      logger.debug(channelNames);
      return response;
    } else {
      logger.error('responsePayloads is null');
      return 'responsePayloads is null';
    }
  } catch (error) {
    logger.error(
      'Failed to query due to error: ' + error.stack ? error.stack : error,
    );
    return error.toString();
  }
};

exports.queryChaincode = queryChaincode;
exports.getBlockByNumber = getBlockByNumber;
exports.getTransactionByID = getTransactionByID;
exports.getBlockByHash = getBlockByHash;
exports.getChainInfo = getChainInfo;
exports.getInstalledChaincodes = getInstalledChaincodes;
exports.getChannels = getChannels;
