const db = require('./db')

function findById(value) {
  var reward = db.find('rewards', {id: value});
  if (reward == null) throw "ERROR_REWARD_DOES_NOT_EXIST";
  return parseRewardToOffer(reward);
}

function parseRewardToOffer(reward) {
  var offer = {};
  offer.identifier = reward.id;
  offer.name = reward.name;
  offer.scope = reward.scope;
  offer.type = reward.type;
  offer.amount = reward.amount;
  return offer;
}

module.exports = {findById}
