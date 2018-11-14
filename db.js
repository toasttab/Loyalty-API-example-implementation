const low = require('lowdb')
const FileSync = require('lowdb/adapters/FileSync')
const adapter = new FileSync('db.json')
const db = low(adapter)

// lowdb is used so the database is simply a json file that you can view and edit!

function push(table, object){
  db.get(table).push(object).write();
}

function update(table, object){
  db.get(table).update(object).write();
}

function find(table, object){
  return db.get(table).find(object).value();
}

function findByKey(table, key, value){
	return db.get(table).filter(function(o) {return o[key].includes(value)}).value();
}

function getAll(table){
  return db.get(table).value();
}

module.exports = { push, update, find, findByKey, getAll }
