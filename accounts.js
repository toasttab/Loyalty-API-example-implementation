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

module.exports = {inquire, search};
