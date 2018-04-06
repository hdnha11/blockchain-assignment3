require('./config.js');

const helper = require('./src/helper.js');

helper.getRegisteredUser('user1', 'alice', true).then(res => console.log(res));
