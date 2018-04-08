const util = require('util');
const helper = require('./helper.js');

const logger = helper.getLogger('Install-Chaincode');
let txId = null;

const installChaincode = async (
  peers,
  chaincodeName,
  chaincodePath,
  chaincodeVersion,
  chaincodeType,
  username,
  orgName,
) => {
  logger.debug('Install chaincode on organizations');
  helper.setupChaincodeDeploy();
  let errorMessage = null;
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

    txId = client.newTransactionID(true); //get an admin transactionID
    const request = {
      targets: peers,
      chaincodePath,
      chaincodeId: chaincodeName,
      chaincodeVersion,
      chaincodeType,
    };
    const results = await client.installChaincode(request);
    // the returned object has both the endorsement results
    // and the actual proposal, the proposal will be needed
    // later when we send a transaction to the orederer
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
        logger.info('install proposal was good');
      } else {
        logger.error('install proposal was bad %j', proposalResponses.toJSON());
      }
      allGood = allGood & oneGood;
    }
    if (allGood) {
      logger.info(
        'Successfully sent install Proposal and received ProposalResponse',
      );
    } else {
      errorMessage =
        'Failed to send install Proposal or receive valid response. Response null or status is not 200';
      logger.error(errorMessage);
    }
  } catch (error) {
    logger.error(
      'Failed to install due to error: ' + error.stack ? error.stack : error,
    );
    errorMessage = error.toString();
  }

  if (!errorMessage) {
    const message = util.format('Successfully install chaincode');
    logger.info(message);
    // build a response to send back to the REST caller
    const response = {
      success: true,
      message,
    };
    return response;
  } else {
    const message = util.format('Failed to install due to:%s', errorMessage);
    logger.error(message);
    throw new Error(message);
  }
};

exports.installChaincode = installChaincode;
