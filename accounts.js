const db = require('./db')
const rewards = require('./rewards')

function inquire(identifier) {
  var account = findByNumber(identifier);
  if(!account['active']) throw "ERROR_CARD_NOT_ACTIVATED";
  return parseLoyaltyAccount(account);
}

function search(criteria) {
  var accounts = find(criteria);
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

module.exports = {inquire, search, accrue};
