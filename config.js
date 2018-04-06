'use strict';

const util = require('util');
const path = require('path');
const hfc = require('fabric-client');

// indicate to the application where the setup file is located so it able
// to have the hfc load it to initalize the fabric client instance
hfc.setConfigSetting(
  'network-connection-profile-path',
  path.join(__dirname, 'config', 'network-config.yaml'),
);
hfc.setConfigSetting(
  'fredrick-connection-profile-path',
  path.join(__dirname, 'config', 'fredrick.yaml'),
);
hfc.setConfigSetting(
  'alice-connection-profile-path',
  path.join(__dirname, 'config', 'alice.yaml'),
);
hfc.setConfigSetting(
  'bob-connection-profile-path',
  path.join(__dirname, 'config', 'bob.yaml'),
);
hfc.addConfigFile(path.join(__dirname, 'config.json'));
