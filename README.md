# Toast Loyalty API example implementation

This repository provides an example implementation of the Toast loyalty 
integration API. For more information about developing a Toast POS system loyalty program 
integration, see [Building a Loyalty Program Integration](https://doc.toasttab.com/Ie5QH/apiBuildingALoyaltyIntegration.html)
in the _Toast API Developer's Guide_.

This example implementation is a basic server written in Node.js that 
handles loyalty transaction requests from the Toast POS system.

This implementation handles:

* Inquiry: search an account by an unique identifier
* Search: find accounts that match the criteria(email, phone, first name and last name)
* Accrue: 1 dollar = 1 points. Every 50 points gets a \$5 check level discount(reward id 2).
* Validate and redeem: validate that all redemptions are available for the account

##

* `db.json` - represents a database. This is where the loyalty accounts, 
  rewards and transactions are stored.

* `db.js` - handles basic database operation like push, update and find

* `accounts.js`, `transactions.js` and `rewards.js` - handles all the 
  code logic

* `server.js` - **The majority of the logic can be found in `server.js`.** 
  This is where incoming requests are handled and dealt with 
  accordingly. It is also where JWT verification is handled.

## How to run it

**First, You have to have `node` and `npm` installed.**

Clone the repository and `cd` into it.

Install all the node dependencies with:

```
npm install
```

Then start the server with:

```
npm start
```

Now the server will be running at `localhost:18182`

By default it will use the public key (for JWT verification) from the 
Toast sandbox environment. However you can change the URL of the public 
key by supplying it as an argument to `npm install`. To use the public 
key from the Toast production environment you start the server as shown 
in the following example:

```
npm start <production public URL here>
```

to reset the database run:

```
npm run reset
```
