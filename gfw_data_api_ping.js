const synthetics = require("Synthetics");
const log = require("SyntheticsLogger");
const AWS = require("aws-sdk");
const https = require("https");
const http = require("http");

const apiCanaryBlueprint = async function () {

  const verifyRequest = async function (requestOption, body = null) {

      // Set log level
      synthetics.setLogLevel(1);

      // Prep request
      log.info("Making request with options: " + JSON.stringify(requestOption));
      const req = https.request(requestOption, (res) => {
        log.info("statusCode:", res.statusCode);
        log.info("headers: ");
        res.on("headers", (header) => { log.info(header.toString()); });

        // Grab body chunks and piece returned body together
        let body = "";
        res.on("data", (chunk) => { body += chunk.toString(); });

        // Resolve providing the returned body
        res.on("end", () => { log.info("RETURN FROM data-api: " + body); });

        if (res.statusCode != 200){
            throw new Error(requestOption.hostname + " seems to be down. Returned status code is " + statusCode);
        } else {
            log.info(requestOption.hostname + " is up and running");
        }
      });

      req.on('error', (e) => {
        log.info ("ERROR: ")
        log.info(e.toString());
      });
      req.end();
    };


/*const verifyRequest = async function (requestOption, body = null) {
    return new Promise((resolve, reject) => {

      // Set log level
      synthetics.setLogLevel(1);

      // Prep request
      log.info("Making request with options: " + JSON.stringify(requestOption));
     let req = (requestOption.port === 443) ? https.request(requestOption) : http.request(requestOption);

      // POST body data
      if (body) { req.write(JSON.stringify(body)); }

      // Handle response
      req.on("response", (res) => {
        log.info(`Status Code: ${res.statusCode}`);

        // Assert the status code returned
        if (res.statusCode !== 200) {
          reject("Failed: " + requestOption.path + " with status code " + res.statusCode + " Making request with options: " + JSON.stringify(requestOption));
        }

        // Grab body chunks and piece returned body together
        let body = "";
        res.on("data", (chunk) => { body += chunk.toString(); });

        // Resolve providing the returned body
        res.on("end", () => { resolve(res.statusCode); log.info("RESULTS RETURNED FROM THE DATA-API: " + body); });
      });

      // Reject on error
      req.on("error", (error) => reject(error));
      req.end();
    });
  };*/



  log.info("Building request options");

  // Build request options for GFW DATA API
  let requestOptionsDataApi = {
    hostname: "data-api.globalforestwatch.org",
    path: "",
    method: "GET",
    port: 443,
    headers: {
      "User-Agent": synthetics.getCanaryUserAgentString(),
      "Content-Type": "application/json",
    },
  };


 log.info("Setting parameters through secrets manager");

  // Find and use secret for auth token
  const secretsManager = new AWS.SecretsManager();
  await secretsManager.getSecretValue({ SecretId: "gfw-api/token" }, function(err, data) {
    if (err) log.info(err, err.stack);
    log.info(data);
    requestOptionsDataApi.headers["Authorization"] = "Bearer " + JSON.parse(data["SecretString"])["token"];
  }).promise();

 await verifyRequest(requestOptionsDataApi);

};

exports.handler = async () => {
  return await apiCanaryBlueprint();
};