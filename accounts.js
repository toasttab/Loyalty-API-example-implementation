const db = require('./db')
const rewards = require('./rewards')

function inquire(identifier) {
  var account = findByNumber(identifier);
  if (!account) throw "ERROR_ACCOUNT_DOES_NOT_EXIST";
  if(!account['active']) throw "ERROR_CARD_NOT_ACTIVATED";
  return parseLoyaltyAccount(account, true);
}

function search(criteria) {
  var accounts = find(criteria);
  if (!accounts) throw "ERROR_ACCOUNT_DOES_NOT_EXIST";
  var result = [];
  for (i in accounts) {
    var account = accounts[i];
    result.push(parseLoyaltyAccount(account, false));
  }
  return result;
}

function accrue(identifier, points) {
  var account = findByNumber(identifier);
  if (!account) throw "ERROR_ACCOUNT_DOES_NOT_EXIST";
  var newPoints = account.points + points;
  if (Math.floor(newPoints/50) > 0) {
    var quantity = Math.floor(newPoints/50);
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
        "id":"2", 
        "quantity": quantity
      }
      account.availableRewards.push(redemption);
    }
    newPoints = newPoints % 50;
  }
  account.points = newPoints;
  db.update(account);
}

function validateOrRedeem(identifier, redemptions, redeem) {
  var account = findByNumber(identifier);
  if (!account) throw "ERROR_ACCOUNT_DOES_NOT_EXIST";
  var availableRewards = account.availableRewards;

  var availableRewards_id_quantity_map = {};
  for (var i in availableRewards) {
    availableRewards_id_quantity_map[availableRewards[i].id] = availableRewards[i].quantity;
  }

  var redemptions_id_quantity_map = {};
  var rejectedRedemptions = [];
  var availableRedemptions = [];
  for (var i in redemptions) {
    var id = redemptions[i].identifier;
    if (availableRewards_id_quantity_map[id]) {
      var availableQuantity = availableRewards_id_quantity_map[id];
      if (redemptions_id_quantity_map[id]) {
        if (redemptions_id_quantity_map[id] >= availableQuantity) {
          var redemption = {
            "redemption": redemptions[i], 
            "message": "more than available quantity"
          }
          rejectedRedemptions.push(redemption);
        } else {
          redemptions_id_quantity_map[id]++;
          availableRedemptions.push(redemptions[i]);
        }
      } else {
        if (availableQuantity > 0) {
          redemptions_id_quantity_map[id] = 1;
          availableRedemptions.push(redemptions[i]);
        } else {
          var redemption = {
            "redemption": redemptions[i], 
            "message": "not available"
          }
          rejectedRedemptions.push(redemptions);
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

  if (redeem && (rejectedRedemptions === undefined || rejectedRedemptions.length == 0)) {
    var i = availableRewards.length;
    while (i--) {
      var id = availableRewards[i].id;
      if (redemptions_id_quantity_map[id]) {
        availableRewards[i].quantity = availableRewards[i].quantity - redemptions_id_quantity_map[id];
        if (availableRewards[i].quantity == 0) {
          availableRewards.splice(i, 1);
        }
      }
    }
    db.update(account);
  }

  var result = {
    rejectedRedemptions: rejectedRedemptions,
    appliedRedemptions: availableRedemptions
  }

  return result;
}

function reverseRedeem(identifier, transaction) {
  var account = findByNumber(identifier);
  if (!account) throw "ERROR_ACCOUNT_DOES_NOT_EXIST";
  var availableRewards = account.availableRewards;
  var redemptions = transaction.redemptions;

  var redemptions_id_quantity_map = {};
  for (var i in redemptions) {
    var id = redemptions[i].identifier;
    if (redemptions_id_quantity_map[id]) {
      redemptions_id_quantity_map[id]++;
    } else {
      redemptions_id_quantity_map[id] = 1;
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

  transaction.reversed = true;
  db.update(transaction);
}

function reverseAccrue(identifier, transaction) {
  var account = findByNumber(identifier);
  if (!account) throw "ERROR_ACCOUNT_DOES_NOT_EXIST";

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

    var currentPoints = reward.quantity*50 + account.points;
    var afterReversePoints = currentPoints - points;
    if (Math.floor(afterReversePoints/50) > 0) {
      var quantity = Math.floor(afterReversePoints/50);
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
  return db.find('loyalty_accounts', {number: value});
}

function findByFirstName(value) {
  return db.findByKey('loyalty_accounts', 'first_name', value);
}

function findByLastName(value) {
  return db.findByKey('loyalty_accounts', 'last_name', value);
}

function findByEmail(value) {
  return db.findByKey('loyalty_accounts', 'email', value);
}

function findByPhone(value) {
  return db.findByKey('loyalty_accounts', 'phone', value);
}

function find(criteria) {
  if (criteria["firstName"]) {
    return findByFirstName(criteria["firstName"].toLowerCase());
  } else if (criteria["lastName"]) {
    return findByLastName(criteria["lastName"].toLowerCase());
  } else if (criteria["email"]) {
    return findByEmail(criteria["email"].toLowerCase());
  } else if (criteria["phone"]) {
    return findByPhone(criteria["phone"].toLowerCase());
  } else {
    throw "ERROR_INVALID_CRITERIA"
  }
}

function parseLoyaltyAccount(loyaltyAccount, inquire) {
  var accountInfo = {};
  accountInfo.identifier = loyaltyAccount.number;
  accountInfo.firstName = loyaltyAccount.first_name;
  accountInfo.lastName = loyaltyAccount.last_name;
  accountInfo.phone = loyaltyAccount.phone;
  accountInfo.email = loyaltyAccount.email;

  if (inquire) {
    var account = {};
    account.accountInfo = accountInfo;

    var availableOffers = loyaltyAccount.availableRewards;
    var offers = [];
    for (var i in availableOffers) {
      var offer = rewards.findById(availableOffers[i].id);
      offer.quantity = availableOffers[i].quantity;
      offers.push(offer);
    }
    account.offers = offers;
    return account;
  }
  return accountInfo;
}

module.exports = {inquire, search, accrue, validateOrRedeem, reverseRedeem, reverseAccrue};
