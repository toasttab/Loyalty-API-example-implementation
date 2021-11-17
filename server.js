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
          case "LOYALTY_TRANSFER":
            var info = getPropOrErr(body, "transferTransactionInformation");
            identifier = getPropOrErr(info, "fromLoyaltyIdentifier");
            var newIdentifier = getPropOrErr(info, "toLoyaltyIdentifier");
            accounts.transfer(identifier, newIdentifier);
            responseBody = {
                transferResponse: result
            };
            return successResponse(res, responseBody);
          case "LOYALTY_REVERSE":
            var info = getPropOrErr(body, "reverseTransactionInformation");
            identifier = info["loyaltyIdentifier"];
            var transactionId = getPropOrErr(info, "transactionId");
            var redemptions = info["redemptions"];
            if (identifier != null) reverse(identifier, transactionId, redemptions);
            return successResponse(res, responseBody);
          default:
            return errorResponse(res, "ERROR_INVALID_TOAST_TRANSACTION_TYPE");
        }
      } catch (e) {
        return errorResponse(res, e);
      }
    });
  })
  .listen(getPort());

console.log("Server is up and listening at localhost:" + getPort());

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

function getPort() {
  if (process.argv[3] != null) {
    return process.argv[3];
  } else {
    return 18182;
  }
}

function getPublicKeyUrl() {
  // get the publicKey URL, which can be supplied as an argument: `npm start <URL>` or `node server.js <URL>`
  if (process.argv[2] != null) {
    return process.argv[2];
  } else {
    throw "public key URL must be supplied!";
  }
}

// Accrue
function accrue(loyaltyIdentifier, check) {
  // This is a simple point system: one dollar = one point
  var accruedPoints = Math.floor(getPropOrErr(check, "totalAmount"));
  if (accruedPoints < 0) {
    throw "ERROR_NO_ACCRUE";
  }
  if (loyaltyIdentifier == null) {
    return 0;
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
  var check = getPropOrErr(info, "check");
  var redemptions = getPropOrErr(info, "redemptions");

  if (transactionType == "LOYALTY_ACCRUE") {
    var identifier = info["loyaltyIdentifier"];
    var accruedPoints = accrue(identifier, check);
    transactions.create(
      transactionType,
      transactionGuid,
      identifier,
      undefined,
      accruedPoints,
      undefined
    );
    responseBody = {
      checkResponse: {
        userMessage: "points accrued: " + accruedPoints
      }
    };
    return successResponse(res, responseBody);
  }

  var identifier = getPropOrErr(info, "loyaltyIdentifier");
  var result = accounts.inquireOrRedeem(
    identifier,
    check,
    redemptions,
    transactionType
  );

  // Redeem successfully
  if (transactionType == "LOYALTY_REDEEM" && 
        (result["rejectedRedemptions"] === undefined ||
         result["rejectedRedemptions"].length == 0)) 
  {
    transactions.create(
      transactionType,
      transactionGuid,
      identifier,
      undefined,
      undefined,
      redemptions
    );
  } else {
    transactions.create(
      transactionType,
      transactionGuid,
      identifier,
      undefined,
      undefined,
      undefined
    );
  }

  responseBody = {
    checkResponse: result
  };
  return successResponse(res, responseBody);
}

// Reverse
function reverse(loyaltyIdentifier, transactionId, redemptions) {
  var transaction = transactions.find(transactionId);
  switch (transaction.method) {
    case "LOYALTY_INQUIRE":
    case "LOYALTY_SEARCH":
    case "LOYALTY_VALIDATE":
    case "LOYALTY_REVERSE":
    case "LOYALTY_TRANSFER":
      throw "ERROR_TRANSACTION_CANNOT_BE_REVERSED";
    case "LOYALTY_REDEEM":
      return reverseRedeem(loyaltyIdentifier, transaction, redemptions);
    case "LOYALTY_ACCRUE":
      if (transaction.reversed) throw "ERROR_TRANSACTION_CANNOT_BE_REVERSED";
      return reverseAccrue(loyaltyIdentifier, transaction);
  }
}

function reverseRedeem(loyaltyIdentifier, transaction, redemptions) {
  if (transaction.redemptions) {
    accounts.reverseRedeem(loyaltyIdentifier, transaction, redemptions);
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
