const http = require("http");
const https = require("https");
const jwt = require("jsonwebtoken");
const util = require("util");

const accounts = require("./accounts");
const transactions = require("./transactions");

// get the public key for JWT verification
var publicKeyUrl = getPublicKeyUrl();
var publicKey;
function parsePublicKey(res) {
  var rawData = "";
  res.on("data", chunk => {
    rawData += chunk;
  });
  res.on("end", () => {
    try {
      publicKey = JSON.parse(rawData)["value"];
    } catch (e) {
      console.error(e.message);
    }
  });
}
if (publicKeyUrl.includes("https")) {
  https.get(publicKeyUrl, res => parsePublicKey(res));
} else {
  http.get(publicKeyUrl, res => parsePublicKey(res));
}

var port = 18182;

// In a real implementation, HTTPS must be used
http
  .createServer((req, res) => {
    if (req.method != "POST") return errorResponse(res);

    // Header
    var transactionType, transactionGuid, restaurantGuid, token;
    try {
      transactionType = getPropOrErr(
        req.headers,
        "Toast-Transaction-Type".toLowerCase(),
        "ERROR_INVALID_TOAST_TRANSACTION_TYPE"
      );
      transactionGuid = getPropOrErr(
        req.headers,
        "Toast-Transaction-GUID".toLowerCase()
      );
      restaurantGuid = getPropOrErr(
        req.headers,
        "Toast-Restaurant-External-ID".toLowerCase()
      );
      token = getPropOrErr(req.headers, "authorization");
    } catch (e) {
      return errorResponse(res, e);
    }

    // Authentication: verify that the JWT is valid and from Toast
    try {
      var decoded = jwt.verify(token, publicKey, { algorithms: ["RS256"] });
    } catch (e) {
      return errorResponse(res, "ERROR_INVALID_TOKEN");
    }

    let body = "";
    req.on("data", chunk => {
      body += chunk.toString(); // converting body buffer to string
    });
    req.on("end", () => {
      try {
        console.log("Request recieved:");
        body = JSON.parse(body); // converting body string to JSON
        console.log(util.inspect(body, false, null, true));
        var info, identifier, check, redemptions, responseBody;
        switch (transactionType) {
          case "LOYALTY_SEARCH":
            info = getPropOrErr(body, "searchTransactionInformation");
            criteria = getPropOrErr(info, "searchCriteria");
            var results = accounts.search(criteria);
            responseBody = {
              searchResponse: {
                accounts: results
              }
            };
            transactions.create(
              transactionType,
              transactionGuid,
              undefined,
              criteria,
              undefined,
              undefined
            );
            return successResponse(res, responseBody);
          case "LOYALTY_INQUIRE":
          case "LOYALTY_REDEEM":
          case "LOYALTY_ACCRUE":
            return parseCheckTransactionInformation(
              body,
              transactionType,
              transactionGuid,
              res,
              responseBody
            );
          case "LOYALTY_REVERSE":
            var info = getPropOrErr(body, "reverseTransactionInformation");
            identifier = getPropOrErr(info, "loyaltyIdentifier");
            var transactionId = getPropOrErr(info, "transactionId");
            reverse(identifier, transactionId);
            return successResponse(res, responseBody);
          default:
            return errorResponse(res, "ERROR_INVALID_TOAST_TRANSACTION_TYPE");
        }
      } catch (e) {
        return errorResponse(res, e);
      }
    });
  })
  .listen(port);

console.log("Server is up and listening at localhost:" + port);

// Helper function
function successResponse(res, responseBody) {
  if (!responseBody) responseBody = {};
  responseBody["transactionStatus"] = "ACCEPT";
  res.writeHead(200, { "Content-Type": "application/json" });
  console.log("Successful response: ");
  console.log(util.inspect(responseBody, false, null, true));
  responseBody = JSON.stringify(responseBody);
  res.end(responseBody);
}

function errorResponse(res, transactionStatus) {
  res.writeHead(400, { "Content-Type": "application/json" });
  console.log("Error response: " + transactionStatus);
  if (transactionStatus != null) {
    res.end(
      JSON.stringify({
        transactionStatus: transactionStatus
      })
    );
  }
}

function getPropOrErr(info, infoProperty, error) {
  var prop = info[infoProperty];
  if (prop == null) {
    if (error == undefined) {
      throw "ERROR_INVALID_INPUT_PROPERTIES";
    }
    throw error;
  }
  return prop;
}

function getPublicKeyUrl() {
  // get the publicKey URL, which can be supplied as an argument: `npm start <URL>` or `node server.js <URL>`
  // if it is not supplied as an argument it will default to the Toast sandbox public key
  if (process.argv[2] != null) {
    return process.argv[2];
  } else {
    return "https://ws-sandbox-api.eng.toasttab.com/usermgmt/v1/oauth/token_key";
  }
}

// Accrue
function accrue(loyaltyIdentifier, check) {
  // This is a simple point system: one dollar = one point
  var accruedPoints = Math.floor(getPropOrErr(check, "subtotal"));
  if (accruedPoints <= 0) {
    throw "ERROR_NO_ACCRUE";
  }
  accounts.accrue(loyaltyIdentifier, accruedPoints);
  return accruedPoints;
}

function parseCheckTransactionInformation(
  body,
  transactionType,
  transactionGuid,
  res,
  responseBody
) {
  var info = getPropOrErr(body, "checkTransactionInformation");
  var identifier = getPropOrErr(info, "loyaltyIdentifier");
  var check = getPropOrErr(info, "check");
  var redemptions = getPropOrErr(info, "redemptions");

  if (transactionType == "LOYALTY_ACCRUE") {
    var accruedPoints = accrue(identifier, check);
    transactions.create(
      transactionType,
      transactionGuid,
      identifier,
      undefined,
      accruedPoints,
      undefined
    );
    return successResponse(res, responseBody);
  }

  var result = accounts.inquireOrRedeem(
    identifier,
    check,
    redemptions,
    transactionType
  );

  if (
    result["rejectedRedemptions"] === undefined ||
    result["rejectedRedemptions"].length == 0
  ) {
    transactions.create(
      transactionType,
      transactionGuid,
      identifier,
      undefined,
      undefined,
      redemptions
    );
    responseBody = {
      checkResponse: result
    };
    return successResponse(res, responseBody);
  } else {
    transactions.create(
      transactionType,
      transactionGuid,
      identifier,
      undefined,
      undefined,
      undefined
    );
    responseBody = {
      checkResponse: result
    };
    return successResponse(res, responseBody);
  }
}

// Reverse
function reverse(loyaltyIdentifier, transactionId) {
  var transaction = transactions.find(transactionId);
  if (transaction.reversed) throw "ERROR_TRANSACTION_ALREADY_BE_REVERSED";
  switch (transaction.method) {
    case "LOYALTY_INQUIRE":
    case "LOYALTY_SEARCH":
    case "LOYALTY_VALIDATE":
    case "LOYALTY_REVERSE":
      throw "ERROR_TRANSACTION_CANNOT_BE_REVERSED";
    case "LOYALTY_REDEEM":
      return reverseRedeem(loyaltyIdentifier, transaction);
    case "LOYALTY_ACCRUE":
      return reverseAccrue(loyaltyIdentifier, transaction);
  }
}

function reverseRedeem(loyaltyIdentifier, transaction) {
  if (transaction.redemptions) {
    accounts.reverseRedeem(loyaltyIdentifier, transaction);
  } else {
    throw "ERROR_TRANSACTION_CANNOT_BE_REVERSED";
  }
}

function reverseAccrue(loyaltyIdentifier, transaction) {
  if (transaction.amount) {
    accounts.reverseAccrue(loyaltyIdentifier, transaction);
  } else {
    throw "ERROR_TRANSACTION_CANNOT_BE_REVERSED";
  }
}
