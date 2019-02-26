const db = require('./db')

function getOffer(value, quantity, item_to_selection_map, redemptions_id_quantity_map) {
  var reward = db.find('rewards', { id: value });
  if (reward == null) throw "ERROR_REWARD_DOES_NOT_EXIST";
  return toOffer(reward, quantity, item_to_selection_map, redemptions_id_quantity_map);
}

function toOffer(reward, quantity, item_to_selection_map, redemptions_id_quantity_map) {
  var check = checkApplicable(reward, quantity, item_to_selection_map, redemptions_id_quantity_map);
  var offer = {};
  var amount = 0.01;
  if (reward.type != "PERCENT") {
    amount = reward.amount;
  }
  offer.identifier = reward.id;
  offer.name = reward.name;
  offer.applicable = check.applicable;
  offer.selectionType = reward.scope;
  offer.amount = amount
  offer.expiration = [];
  if (reward.expiryDate != null) {
    expirationDate = {
      date: reward.expiryDate,
      quantity: quantity
    }
    offer.expiration.push(expirationDate);
  }
  if (offer.selectionType == "ITEM" && check.item_id != null) {
    var itemInfo = {};
    itemInfo.selectionIdentifier = check.item_id;
    itemInfo.amount = amount
    offer.itemApplication = [];
    offer.itemApplication.push(itemInfo);
  }
  offer.quantity = quantity > 0 ? quantity : 0;

  return offer;
}

// Simple Rules:
//    1. reward available
//    2. each reward can only be used once per check
//    3. the item is available in the check
//    4. the reward is always apply to the first item available in the list and the check
function checkApplicable(reward, quantity, item_to_selection_map, redemptions_id_quantity_map) {
  var result = {}
  var itemsApplied = reward.item_id;

  if (quantity <= 0) {
    result.applicable = false;
    return result;
  }

  if (itemsApplied.length == 0) {
    result.applicable = true;
    return result;
  }

  if (reward.type == null || reward.type != "BOGO" || item_to_selection_map[reward.prereq] != null) {
    for (var i in itemsApplied) {
      var id = itemsApplied[i];
      if (item_to_selection_map[id]) {
        result.applicable = true;
        result.item_id = item_to_selection_map[id].selections[0].guid;
        return result;
      }
    }
  }

  result.applicable = false;
  return result;
}

module.exports = { getOffer }
