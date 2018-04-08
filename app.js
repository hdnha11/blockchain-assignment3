const log4js = require('log4js');
const express = require('express');
const bodyParser = require('body-parser');
const expressJwt = require('express-jwt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const hfc = require('fabric-client');

require('./config.js');

const helper = require('./src/helper.js');
const query = require('./src/query.js');
const {createChannel} = require('./src/create-channel.js');
const {joinChannel} = require('./src/join-channel.js');
const {installChaincode} = require('./src/install-chaincode.js');
const {instantiateChaincode} = require('./src/instantiate-chaincode.js');
const {invokeChaincode} = require('./src/invoke-transaction.js');

const app = express();
const logger = log4js.getLogger('SalmonNetwork');

const host = process.env.HOST || hfc.getConfigSetting('host');
const port = process.env.PORT || hfc.getConfigSetting('port');
const secret = process.env.SECRET || 'my-super-secret!';

app.options('*', cors());
app.use(cors());
app.use(bodyParser.json());
app.use(
  bodyParser.urlencoded({
    extended: false,
  }),
);
app.use(
  expressJwt({
    secret,
  }).unless({
    path: ['/users'],
  }),
);

app.use((err, req, res, next) => {
  if (err.name === 'UnauthorizedError') {
    res.status(401).json({error: 'Invalid token!'});
  }
});

app.listen(port, host, () => {
  logger.info('SERVER STARTED');
  logger.info('http://%s:%s', host, port);
});

// Register and enroll user
app.get('/users', async (req, res) => {
  const username = req.query.username;
  const orgName = req.query.orgName;

  if (!username) {
    res.status(400).json({error: 'Missing Username'});
    return;
  }

  if (!orgName) {
    res.status(400).json({error: 'Missing Org Name'});
    return;
  }

  let response = await helper.getRegisteredUser(username, orgName, true);
  logger.debug(
    '-- returned from registering the username %s for organization %s',
    username,
    orgName,
  );

  if (response && typeof response !== 'string') {
    logger.debug(
      'Successfully registered the username %s for organization %s',
      username,
      orgName,
    );

    response.token = jwt.sign(
      {
        exp:
          Math.floor(Date.now() / 1000) +
          parseInt(hfc.getConfigSetting('jwt-expiretime')),
        username: username,
        orgName: orgName,
      },
      secret,
    );
    res.json(response);
  } else {
    logger.debug(
      'Failed to register the username %s for organization %s with::%s',
      username,
      orgName,
      response,
    );
    res.status(500).json({error: response});
  }
});

// Create Channel
app.post('/channels', async (req, res) => {
  logger.info('CREATE CHANNEL');
  logger.debug('End point: /channels');
  const channelName = req.body.channelName;
  const channelConfigPath = req.body.channelConfigPath;
  logger.debug(`Channel name: ${channelName}`);
  logger.debug(`channelConfigPath: ${channelConfigPath}`); //../artifacts/channel/mychannel.tx
  if (!channelName) {
    res.status(400).json({error: 'Missing channelName'});
    return;
  }
  if (!channelConfigPath) {
    res.status(400).json({error: 'Missing channelConfigPath'});
    return;
  }

  try {
    const message = await createChannel(
      channelName,
      channelConfigPath,
      req.user.username,
      req.user.orgName,
    );
    res.json(message);
  } catch (ex) {
    res.status(500).json({error: ex.toString()});
  }
});

// Join Channel
app.post('/channels/:channelName/peers', async (req, res) => {
  logger.info('JOIN CHANNEL');
  const channelName = req.params.channelName;
  const peers = req.body.peers;
  logger.debug(`channelName: ${channelName}`);
  logger.debug(`peers: ${peers}`);
  logger.debug(`username: ${req.user.username}`);
  logger.debug(`orgName: ${req.user.orgName}`);

  if (!channelName) {
    res.status(400).json({error: 'Missing channelName'});
    return;
  }

  if (!peers || peers.length == 0) {
    res.status(400).json({error: 'Missing peers'});
    return;
  }

  try {
    const message = await joinChannel(
      channelName,
      peers,
      req.user.username,
      req.user.orgName,
    );
    res.json(message);
  } catch (ex) {
    res.status(500).json({error: ex.toString()});
  }
});

// Install chaincode on target peers
app.post('/chaincodes', async (req, res) => {
  logger.debug('INSTALL CHAINCODE');
  const peers = req.body.peers;
  const chaincodeName = req.body.chaincodeName;
  const chaincodePath = req.body.chaincodePath;
  const chaincodeVersion = req.body.chaincodeVersion;
  const chaincodeType = req.body.chaincodeType;
  logger.debug(`peers: ${peers}`); // target peers list
  logger.debug(`chaincodeName: ${chaincodeName}`);
  logger.debug(`chaincodePath: ${chaincodePath}`);
  logger.debug(`chaincodeVersion: ${chaincodeVersion}`);
  logger.debug(`chaincodeType: ${chaincodeType}`);
  if (!peers || peers.length == 0) {
    res.status(400).json({error: 'Missing peers'});
    return;
  }
  if (!chaincodeName) {
    res.status(400).json({error: 'Missing chaincodeName'});
    return;
  }
  if (!chaincodePath) {
    res.status(400).json({error: 'Missing chaincodePath'});
    return;
  }
  if (!chaincodeVersion) {
    res.status(400).json({error: 'Missing chaincodeVersion'});
    return;
  }
  if (!chaincodeType) {
    res.status(400).json({error: 'Missing chaincodeType'});
    return;
  }

  try {
    const message = await installChaincode(
      peers,
      chaincodeName,
      chaincodePath,
      chaincodeVersion,
      chaincodeType,
      req.user.username,
      req.user.orgName,
    );
    res.json(message);
  } catch (ex) {
    res.status(500).json({error: ex.toString()});
  }
});

// Instantiate chaincode on target peers
app.post('/channels/:channelName/chaincodes', async (req, res) => {
  logger.debug('INSTANTIATE CHAINCODE');
  const peers = req.body.peers;
  const chaincodeName = req.body.chaincodeName;
  const chaincodeVersion = req.body.chaincodeVersion;
  const channelName = req.params.channelName;
  const chaincodeType = req.body.chaincodeType;
  const fcn = req.body.fcn;
  const args = req.body.args;
  logger.debug(`peers: ${peers}`);
  logger.debug(`channelName: ${channelName}`);
  logger.debug(`chaincodeName: ${chaincodeName}`);
  logger.debug(`chaincodeVersion: ${chaincodeVersion}`);
  logger.debug(`chaincodeType: ${chaincodeType}`);
  logger.debug(`fcn: ${fcn}`);
  logger.debug(`args: ${args}`);
  if (!chaincodeName) {
    res.status(400).json({error: 'Missing chaincodeName'});
    return;
  }
  if (!chaincodeVersion) {
    res.status(400).json({error: 'Missing chaincodeVersion'});
    return;
  }
  if (!channelName) {
    res.status(400).json({error: 'Missing channelName'});
    return;
  }
  if (!chaincodeType) {
    res.status(400).json({error: 'Missing chaincodeType'});
    return;
  }
  if (!args) {
    res.status(400).json({error: 'Missing args'});
    return;
  }

  try {
    const message = await instantiateChaincode(
      peers,
      channelName,
      chaincodeName,
      chaincodeVersion,
      chaincodeType,
      fcn,
      args,
      req.user.username,
      req.user.orgName,
    );
    res.json(message);
  } catch (ex) {
    res.status(500).json({error: ex.toString()});
  }
});

// Invoke transaction on chaincode on target peers
app.post(
  '/channels/:channelName/chaincodes/:chaincodeName',
  async (req, res) => {
    logger.debug('INVOKE ON CHAINCODE');
    const peers = req.body.peers;
    const chaincodeName = req.params.chaincodeName;
    const channelName = req.params.channelName;
    const fcn = req.body.fcn;
    const args = req.body.args;
    logger.debug(`channelName: ${channelName}`);
    logger.debug(`chaincodeName: ${chaincodeName}`);
    logger.debug(`fcn: ${fcn}`);
    logger.debug(`args: ${args}`);
    if (!chaincodeName) {
      res.status(400).json({error: 'Missing chaincodeName'});
      return;
    }
    if (!channelName) {
      res.status(400).json({error: 'Missing channelName'});
      return;
    }
    if (!fcn) {
      res.status(400).json({error: 'Missing fcn'});
      return;
    }
    if (!args) {
      res.status(400).json({error: 'Missing args'});
      return;
    }

    try {
      const message = await invokeChaincode(
        peers,
        channelName,
        chaincodeName,
        fcn,
        args,
        req.user.username,
        req.user.orgName,
      );
      res.json(message);
    } catch (ex) {
      res.status(500).json({error: ex.toString()});
    }
  },
);

// Query on chaincode on target peers
app.get(
  '/channels/:channelName/chaincodes/:chaincodeName',
  async (req, res) => {
    logger.debug('QUERY BY CHAINCODE');
    const channelName = req.params.channelName;
    const chaincodeName = req.params.chaincodeName;
    let args = req.query.args;
    const fcn = req.query.fcn;
    const peer = req.query.peer;

    logger.debug(`channelName: ${channelName}`);
    logger.debug(`chaincodeName: ${chaincodeName}`);
    logger.debug(`fcn: ${fcn}`);
    logger.debug(`args: ${args}`);

    if (!chaincodeName) {
      res.status(400).json({error: 'Missing chaincodeName'});
      return;
    }
    if (!channelName) {
      res.status(400).json({error: 'Missing channelName'});
      return;
    }
    if (!fcn) {
      res.status(400).json({error: 'Missing fcn'});
      return;
    }
    if (!args) {
      res.status(400).json({error: 'Missing args'});
      return;
    }
    args = args.replace(/'/g, '"');
    args = JSON.parse(args);
    logger.debug(args);

    try {
      const message = await query.queryChaincode(
        peer,
        channelName,
        chaincodeName,
        args,
        fcn,
        req.user.username,
        req.user.orgName,
      );
      res.json(message);
    } catch (ex) {
      res.status(500).json({error: ex.toString()});
    }
  },
);
