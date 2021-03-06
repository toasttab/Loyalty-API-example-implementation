const db = require('./db')

function getOffer(value, quantity, check_item_guid_map, redemptions_id_quantity_map) {
  var reward = db.find('rewards', {id: value});
  if (reward == null) throw "ERROR_REWARD_DOES_NOT_EXIST";
  return toOffer(reward, quantity, check_item_guid_map, redemptions_id_quantity_map);
}

function toOffer(reward, quantity, check_item_guid_map, redemptions_id_quantity_map) {
  var check = checkApplicable(reward, quantity, check_item_guid_map, redemptions_id_quantity_map);
  var offer = {};
  var amount = 0.01;
  if (reward.type != "PERCENT") {
    amount = reward.amount;
  }
  if (reward.type == "RANDOM") {
    amount = Math.floor(Math.random() * amount * 100)/100;
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
  if ((offer.selectionType == "ITEM" || offer.selectionType == "MULTI_ITEM") && check.item_id != null && check.applicable) {
    offer.itemApplication = [];
    offer.amount = 0
    offer.quantity = 1
    check.item_id.forEach(function(application) {
      var itemInfo = {};
      itemInfo.selectionIdentifier = application.selectionGUID
      itemInfo.amount = application.amount
      offer.amount += Number(application.amount)
      offer.itemApplication.push(itemInfo);
    })
  }
  offer.quantity = quantity > 0 ? quantity : 0;

  return offer;
}

// Simple Rules:
//    1. reward available
//    2. each reward can only be used once per check
//    3. the item is available in the check
//    4. the reward is always apply to the first item available in the list and the check
function checkApplicable(reward, quantity, check_item_guid_map, redemptions_id_quantity_map) {
  var result = {}
  result.item_id = []
  var itemsApplied = reward.item_id;

  if (quantity <= 0) {
    result.applicable = false;
    return result;
  }

  if (itemsApplied.length == 0) {
    result.applicable = true;
    return result;
  }
  if (reward.scope == "MULTI_ITEM" || reward.type == "ITEM") {
    result.item_id = []
    for ( i in itemsApplied) {
      var item = itemsApplied[i]
      var id = item.menuItemGuid
      if (!check_item_guid_map[id]) {
        result.applicable = false;
        return result;
      }
      result.item_id.push({"selectionGUID":check_item_guid_map[id][0], "amount":item.amount})
    }
    result.applicable = true;
    return result;
  }

  result.applicable = false;
  return result;
}

module.exports = {getOffer}
