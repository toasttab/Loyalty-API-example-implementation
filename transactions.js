const db = require('./db')

function create(type, transactionGuid, identifier, criteria, amount, redemptions){
  if (transactionGuid == null) throw "ERROR_INVALID_INPUT_PROPERTIES";

  for (var i in redemptions) {
    redemptions[i].reversed = false;
  }

  db.push('transactions', {
    guid: transactionGuid,
    method: type,
    amount: amount,
    redemptions: redemptions,
    cardNumber: identifier,
    criteria: criteria,
    reversed: false
  });
}

function update(transaction){
  if (transaction['guid'] == null) throw "ERROR_INVALID_INPUT_PROPERTIES";
  db.update('transactions', transaction);
}

function find(transactionGuid){
  var txn = db.find('transactions', {guid: transactionGuid});
  if (txn == null) throw "ERROR_TRANSACTION_DOES_NOT_EXIST";
  return txn;
}

module.exports = {create, update, find}
