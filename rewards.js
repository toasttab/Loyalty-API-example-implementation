const db = require('./db')

function getOffer(value, quantity) {
  var reward = db.find('rewards', {id: value});
  if (reward == null) throw "ERROR_REWARD_DOES_NOT_EXIST";
  return toOffer(reward, quantity);
}

function toOffer(reward, quantity) {
  var applicable = true;
  if (quantity <= 0) {
    applicable = false;
    quantity = 0;
  }

  var offer = {};
  offer.identifier = reward.id;
  offer.name = reward.name;
  offer.applicable = applicable;
  offer.selectionType = reward.scope;
  offer.type = reward.type;
  if (offer.type == "PERCENT") {
    offer.percentage = reward.amount;
  } else {
    offer.amount = reward.amount;
  }
  offer.selectionIdentifier = reward.item_id;
  offer.quantity = quantity;

  return offer;
}

module.exports = {getOffer}
