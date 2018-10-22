const db = require('./db')

function getOffer(value, quantity, check_item_quantity_map, redemptions_id_quantity_map) {
  var reward = db.find('rewards', {id: value});
  if (reward == null) throw "ERROR_REWARD_DOES_NOT_EXIST";
  return toOffer(reward, quantity, check_item_quantity_map, redemptions_id_quantity_map);
}

function toOffer(reward, quantity, check_item_quantity_map, redemptions_id_quantity_map) {
  var check = checkApplicable(reward, quantity, check_item_quantity_map, redemptions_id_quantity_map);
  var offer = {};
  offer.identifier = reward.id;
  offer.name = reward.name;
  offer.applicable = check.applicable;
  offer.selectionType = reward.scope;
  offer.type = reward.type;
  if (offer.type == "PERCENT") {
    offer.percentage = reward.amount;
  } else {
    offer.amount = reward.amount;
  }
  offer.selectionIdentifier = check.item_id;
  offer.quantity = quantity > 0 ? quantity : 0;

  return offer;
}

// Simple Rules:
//    1. reward available
//    2. each reward can only be used once per check
//    3. the item is available in the check
//    4. the reward is always apply to the first item available in the check
function checkApplicable(reward, quantity, check_item_quantity_map, redemptions_id_quantity_map) {
  var result = {}
  var itemsApplied = reward.item_id;

  if (quantity <= 0 || redemptions_id_quantity_map[reward.id]) {
    result.applicable = false;
    return result;
  }

  for (var i in itemsApplied) {
   var id = itemsApplied[i];
   if (check_item_quantity_map[id]) {
    result.applicable = true;
    result.item_id = id;
    return result;
   } 
  }

  result.applicable = false;
  return result;
}

module.exports = {getOffer}
