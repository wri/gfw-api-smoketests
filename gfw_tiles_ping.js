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



  log.info("Building request options");

  // Build request options for GFW DATA API
  let requestOptionsDataApi = {
    hostname: "tiles.globalforestwatch.org",
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