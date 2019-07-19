const db = require('./db')
const rewards = require('./rewards')

function search(criteria) {
  var accounts = find(criteria);
  if (!accounts) throw "ERROR_ACCOUNT_INVALID";
  var result = [];
  for (i in accounts) {
    var account = accounts[i];
    result.push(toAccountInfo(account));
  }
  return result;
}

// Transfer Rule: cannot transfer loyalty account to an existing account
function transfer(fromIdentifier, toIdentifier) {
    var fromAccount = findByNumber(fromIdentifier);
    var toAccount = findByNumber(toIdentifier);
    if (!fromAccount) throw "ERROR_INVALID_TRANSFER";
    if (toAccount) {
      throw "ERROR_INVALID_TRANSFER"
    } else {
      fromAccount.number = toIdentifier;
      db.update('loyalty_accounts', fromAccount);
    }

    toAccount = findByNumber(toIdentifier);

    return result = {
      loyaltyIdentifier: toAccount.number
    }

}

function accrue(identifier, points) {
  var account = findByNumber(identifier);
  if (!account) throw "ERROR_ACCOUNT_INVALID";
  var newPoints = account.points + points;
  if (Math.floor(newPoints / 50) > 0) {
    var quantity = Math.floor(newPoints / 50);
    var availableRewards = account.availableRewards;
    var reward;
    for (var i in availableRewards) {
      if (availableRewards[i].id == "2") {
        reward = availableRewards[i];
      }
    }
    if (reward) {
      reward.quantity = reward.quantity + quantity;
    } else {
      var redemption = {
        "id": "2",
        "quantity": quantity
      }
      account.availableRewards.push(redemption);
    }
    newPoints = newPoints % 50;
  }
  account.points = newPoints;
  db.update(account);
}

function reverseRedeem(identifier, transaction, reverseRedemptions) {
  var account = findByNumber(identifier);
  if (!account) throw "ERROR_ACCOUNT_INVALID";
  var availableRewards = account.availableRewards;
  var redemptions = transaction.redemptions;

  var redemptions_guid_index_map = {};
  for (var i in redemptions) {
    if (redemptions[i].appliedDiscountGuid) {
      redemptions_guid_index_map[redemptions[i].appliedDiscountGuid] = i;
    } else {
      redemptions_guid_index_map[redemptions[i].multiItemDiscountGuid] = i;
    }
  }

  var redemptions_id_quantity_map = {};
  for (var i in reverseRedemptions) {
    // the guid will either be an appliedDiscountGuid (item/check level) or
    // a multi level discount has its own guid
    var guid = reverseRedemptions[i].appliedDiscountGuid;
    if (!guid) guid = reverseRedemptions[i].multiItemDiscountGuid;
    if (redemptions_guid_index_map[guid]) {
      if (redemptions[redemptions_guid_index_map[guid]].reversed == false) {
        var id = redemptions[redemptions_guid_index_map[guid]].identifier;
        if (redemptions_id_quantity_map[id]) {
          redemptions_id_quantity_map[id]++;
        } else {
          redemptions_id_quantity_map[id] = 1;
        }
      } else {
        throw "ERROR_TRANSACTION_CANNOT_BE_REVERSED";
      }
    } else {
      throw "ERROR_TRANSACTION_DOES_NOT_EXIST";
    }
  }

  var i = availableRewards.length;
  while (i--) {
    var id = availableRewards[i].id;
    if (redemptions_id_quantity_map[id]) {
      availableRewards[i].quantity = availableRewards[i].quantity + redemptions_id_quantity_map[id];
      delete redemptions_id_quantity_map[id];
    }
  }

  for (var key in redemptions_id_quantity_map) {
    if (redemptions_id_quantity_map.hasOwnProperty(key)) {
      var redemption = {
        id: key,
        quantity: redemptions_id_quantity_map[key]
      }
      availableRewards.push(redemption);
    }
  }
  db.update(account);


  // updated reverse status
  for (var i in reverseRedemptions) {
    var guid = reverseRedemptions[i].appliedDiscountGuid;
    if (guid) {
      redemptions[redemptions_guid_index_map[guid]].reversed = true;
    } else {
      guid = reverseRedemptions[i].multiItemDiscountGuid;
      redemptions[redemptions_guid_index_map[guid]].reversed = true;
    }
  }

  db.update(transaction);
}

function reverseAccrue(identifier, transaction) {
  var account = findByNumber(identifier);
  if (!account) throw "ERROR_ACCOUNT_INVALID";

  var points = transaction.amount;
  if (points < account.points) {
    account.points = account.points - points;
  } else {
    var availableRewards = account.availableRewards;
    var reward;
    var rewardIndex;
    for (var i in availableRewards) {
      if (availableRewards[i].id == "2") {
        reward = availableRewards[i];
        rewardIndex = i;
      }
    }
    if (!reward) throw "ERROR_UNABLE_TO_REVERSE";

    var currentPoints = reward.quantity * 50 + account.points;
    var afterReversePoints = currentPoints - points;
    if (Math.floor(afterReversePoints / 50) > 0) {
      var quantity = Math.floor(afterReversePoints / 50);
      reward.quantity = quantity;
      afterReversePoints = afterReversePoints % 50;
    } else {
      account.availableRewards.splice(rewardIndex, 1);
    }
    account.points = afterReversePoints;
  }

  db.update(account);
  transaction.reversed = true;
  db.update(transaction);
}

function findByNumber(value) {
  return db.find('loyalty_accounts', { number: value });
}

function findByKey(key, value) {
  return db.findByKey('loyalty_accounts', key, value);
}

function find(criteria) {
  if (criteria["firstName"]) {
    return findByKey('first_name', criteria["firstName"].toLowerCase());
  } else if (criteria["lastName"]) {
    return findByKey('last_name', criteria["lastName"].toLowerCase());
  } else if (criteria["email"]) {
    return findByKey('email', criteria["email"].toLowerCase());
  } else if (criteria["phone"]) {
    return findByKey('phone', criteria["phone"].toLowerCase());
  } else {
    return db.getAll('loyalty_accounts');
  }
}

function toAccountInfo(loyaltyAccount) {
  var accountInfo = {};
  accountInfo.identifier = loyaltyAccount.number;
  accountInfo.firstName = loyaltyAccount.first_name;
  accountInfo.lastName = loyaltyAccount.last_name;
  accountInfo.phone = loyaltyAccount.phone;
  accountInfo.email = loyaltyAccount.email;
  accountInfo.pointsBalance = loyaltyAccount.points;
  return accountInfo;
}

function inquireOrRedeem(identifier, check, redemptions, transactionType) {
  // get the account information and all available offers
  var account = findByNumber(identifier);
  if (!account) throw "ERROR_ACCOUNT_INVALID";
  if (!account['active']) throw "ERROR_CARD_NOT_ACTIVATED";
  var availableRewards = account.availableRewards;

  var offers = [];
  var rejectedRedemptions = [];
  var availableRedemptions = [];

  // Get all the available item in the check
  check_item_guid_map = {};
  all_selection_guids = {};
  if (check.selections != null) {
    for (var i in check.selections) {
      var selection = check.selections[i];
      all_selection_guids[selection.guid] = !selection.voided
      if (!selection.voided) {
        // Can't apply discounts to items with discounts
        if (selection.appliedDiscounts == null || selection.appliedDiscounts.length == 0) {
          if (check_item_guid_map[selection.guid]) {
            check_item_guid_map[selection.item.guid].push(selection.guid);
          } else {
            check_item_guid_map[selection.item.guid] = [selection.guid];
          }
          for (var j in selection.modifiers) {
            var modifier = selection.modifiers[j];
            if (check_item_guid_map[modifier.item.guid]) {
              check_item_guid_map[modifier.item.guid].push(selection.guid);
            } else {
              check_item_guid_map[modifier.item.guid] = [selection.guid];
            }
          }
        }
      }
    }
  }

  // offer id and its quantity for all available offers in this account
  var availableRewards_id_quantity_map = {};
  for (var i in availableRewards) {
    availableRewards_id_quantity_map[availableRewards[i].id] = availableRewards[i].quantity;
  }

  var redemptions_id_quantity_map = {};
  for (var i in redemptions) {
    var id = redemptions[i].identifier;
    if (availableRewards_id_quantity_map[id]) {
      var reward = db.find('rewards', { id: id });
      var availableQuantity = availableRewards_id_quantity_map[id];
      if (reward.type == "MULTI_ITEM") {
        var rejected = false
        for (var x in redemptions[i].itemApplication) {
          var application = redemptions[i].itemApplication[x]
          // item is not on check (not in all_selection_guids), voided (false in all_selection_guids),
          // or there are more required items in the ward than the redemption has
          if (!all_selection_guids[application.selectionIdentifier] || reward.item_id.length > redemptions[i].itemApplication.length) {
            var redemption = {
              "redemption": redemptions[i],
              "message": "Not all requisit items are on the check"
            }
            rejectedRedemptions.push(redemption);
            rejected = true
            break;
          }
        }
        if (!rejected) {
          availableRedemptions.push(updateRedemption(reward, redemptions[i], check));
          if (redemptions_id_quantity_map[id]) {
            redemptions_id_quantity_map[id]++
          } else {
            redemptions_id_quantity_map[id] = 1;
          }
        }
      } else {
        if (redemptions_id_quantity_map[id]) {
          if (redemptions_id_quantity_map[id] >= availableQuantity) {
            var redemption = {
              "redemption": redemptions[i],
              "message": "more than available quantity"
            }
            rejectedRedemptions.push(redemption);
          } else {
            redemptions_id_quantity_map[id]++;
            availableRedemptions.push(updateRedemption(reward, redemptions[i], check));
          }
        } else {
          if (availableQuantity > 0) {
            redemptions_id_quantity_map[id] = 1;
            availableRedemptions.push(updateRedemption(reward, redemptions[i], check));
          } else {
            var redemption = {
              "redemption": redemptions[i],
              "message": "not available"
            }
            rejectedRedemptions.push(redemptions);
          }
        }
      }
    } else {
      var redemption = {
        "redemption": redemptions[i],
        "message": "this is not an available reward"
      }
      rejectedRedemptions.push(redemption);
    }
  }

  // calculate the available offer list
  for (var i in availableRewards) {
    var id = availableRewards[i].id;
    var currentQuantity = availableRewards_id_quantity_map[id];
    if (redemptions_id_quantity_map[id]) {
      currentQuantity = currentQuantity - redemptions_id_quantity_map[id];
    }
    offers.push(rewards.getOffer(id, currentQuantity, check_item_guid_map, redemptions_id_quantity_map));
  }

  if (transactionType == "LOYALTY_REDEEM" && (rejectedRedemptions === undefined || rejectedRedemptions.length == 0)) {
    var i = availableRewards.length;
    while (i--) {
      var id = availableRewards[i].id;
      if (redemptions_id_quantity_map[id]) {
        availableRewards[i].quantity -= redemptions_id_quantity_map[id];
        if (availableRewards[i].quantity == 0) {
          availableRewards.splice(i, 1);
        }
      }
    }
    db.update(account);
  }

  var result = {
    accountInfo: toAccountInfo(account),
    offers: offers,
    rejectedRedemptions: rejectedRedemptions,
    appliedRedemptions: availableRedemptions,
    userMessage: "Visit http://www.website.com to check your points balance"
  }

  return result;
}

function updateRedemption(reward, redemption, check) {
  if (reward.type == "PERCENT") {
    if (reward.scope == "CHECK") {
      var amount = check.totalAmount + redemption.amount - check.taxAmount;
      redemption.amount = amount * reward.amount / 100;
    }
  }
  if (reward.type == "RANDOM") {
    // if random multi item give each item $ value from $0.00 - $7.99
    if (redemption.itemApplication) {
      for (var i = 0; i < redemption.itemApplication.length; i++) {
        redemption.itemApplication[i].amount = Math.floor(Math.random() * 7) + Math.random() + Math.random() * 0.1
        redemption.amount += redemption.itemApplication[i].amount
      }
    } else {
      redemption.amount = Math.floor(Math.random() * reward.amount * 100)/100;
    }
  }
  return redemption;
}

module.exports = { search, accrue, inquireOrRedeem, reverseRedeem, reverseAccrue, transfer };
