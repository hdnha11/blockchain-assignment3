const log4js = require('log4js');
const path = require('path');
const util = require('util');
const hfc = require('fabric-client');

const getLogger = moduleName => {
  const logger = log4js.getLogger(moduleName);
  logger.setLevel('DEBUG');
  return logger;
};

const logger = getLogger('Helper');
hfc.setLogger(logger);

const getClientForOrg = async (userorg, username) => {
  logger.debug('getClientForOrg - ****** START %s %s', userorg, username);
  // get a fabric client loaded with a connection profile for this org
  let config = '-connection-profile-path';

  // build a client context and load it with a connection profile
  // lets only load the network settings and save the client for later
  let client = hfc.loadFromConfig(hfc.getConfigSetting('network' + config));

  // This will load a connection profile over the top of the current one one
  // since the first one did not have a client section and the following one does
  // nothing will actually be replaced.
  // This will also set an admin identity because the organization defined in the
  // client section has one defined
  client.loadFromConfig(hfc.getConfigSetting(userorg + config));

  // this will create both the state store and the crypto store based
  // on the settings in the client section of the connection profile
  await client.initCredentialStores();

  // The getUserContext call tries to get the user from persistence.
  // If the user has been saved to persistence then that means the user has
  // been registered and enrolled. If the user is found in persistence
  // the call will then assign the user to the client object.
  if (username) {
    let user = await client.getUserContext(username, true);
    if (!user) {
      throw new Error(util.format('User was not found :', username));
    } else {
      logger.debug('User %s was found to be registered and enrolled', username);
    }
  }
  logger.debug('getClientForOrg - ****** END %s %s \n\n', userorg, username);

  return client;
};

const getRegisteredUser = async (username, userOrg, isJson) => {
  try {
    const client = await getClientForOrg(userOrg);
    logger.debug('Successfully initialized the credential stores');
    // client can now act as an agent for organization Org1
    // first check to see if the user is already enrolled
    let user = await client.getUserContext(username, true);
    if (user && user.isEnrolled()) {
      logger.info('Successfully loaded member from persistence');
    } else {
      // user was not enrolled, so we will need an admin user object to register
      logger.info(
        'User %s was not enrolled, so we will need an admin user object to register',
        username,
      );
      const admins = hfc.getConfigSetting('admins');
      let adminUserObj = await client.setUserContext({
        username: admins[0].username,
        password: admins[0].secret,
      });
      let caClient = client.getCertificateAuthority();
      let secret = await caClient.register(
        {
          enrollmentID: username,
          affiliation: userOrg.toLowerCase() + '.department1',
        },
        adminUserObj,
      );
      logger.debug('Successfully got the secret for user %s', username);
      user = await client.setUserContext({
        username,
        password: secret,
      });
      logger.debug(
        'Successfully enrolled username %s  and setUserContext on the client object',
        username,
      );
    }
    if (user && user.isEnrolled) {
      if (isJson && isJson === true) {
        const response = {
          success: true,
          secret: user._enrollmentSecret,
          message: username + ' enrolled Successfully',
        };
        return response;
      }
    } else {
      throw new Error('User was not enrolled ');
    }
  } catch (error) {
    logger.error(
      'Failed to get registered user: %s with error: %s',
      username,
      error.toString(),
    );
    return 'Failed ' + error.toString();
  }
};

const setupChaincodeDeploy = () => {
  process.env.GOPATH = path.join(
    __dirname,
    hfc.getConfigSetting('chaincode-src-path'),
  );
};

exports.getLogger = getLogger;
exports.getClientForOrg = getClientForOrg;
exports.getRegisteredUser = getRegisteredUser;
exports.setupChaincodeDeploy = setupChaincodeDeploy;
