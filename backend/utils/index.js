const config = require('./config');
const telegram = require('./telegram');
const ssh = require('./ssh');

module.exports = {
  ...config,
  ...telegram,
  ...ssh
};
