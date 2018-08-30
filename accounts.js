const db = require('./db')
const rewards = require('./rewards')

function inquire(identifier) {
  var account = findByNumber(identifier);
  if (!account) throw "ERROR_ACCOUNT_DOES_NOT_EXIST";
  if(!account['active']) throw "ERROR_CARD_NOT_ACTIVATED";
  return parseLoyaltyAccount(account);
}

function search(criteria) {
  var accounts = find(criteria);
  if (!accounts) throw "ERROR_ACCOUNT_DOES_NOT_EXIST";
  var result = [];
  for (i in accounts) {
    var account = accounts[i];
    result.push(parseLoyaltyAccount(account));
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
  for (var i in redemptions) {
    var id = redemptions[i].identifier;
    if (availableRewards_id_quantity_map[id]) {
      var availableQuantity = availableRewards_id_quantity_map[id];
      if (redemptions_id_quantity_map[id]) {
        if (redemptions_id_quantity_map[id] >= availableQuantity) {
          rejectedRedemptions.push(redemptions[i]);
        } else {
          redemptions_id_quantity_map[id]++;
        }
      } else {
        if (availableQuantity > 0) {
          redemptions_id_quantity_map[id] = 1;
        } else {
          rejectedRedemptions.push(redemptions[i]);
        }
      }
    } else {
      rejectedRedemptions.push(redemptions[i]);
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

  return rejectedRedemptions;
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

function parseLoyaltyAccount(loyaltyAccount) {
  var account = {};
  account.identifier = loyaltyAccount.number;
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

module.exports = {inquire, search, accrue, validateOrRedeem};
