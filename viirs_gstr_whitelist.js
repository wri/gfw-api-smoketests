const synthetics = require("Synthetics");
const log = require("SyntheticsLogger");
const AWS = require("aws-sdk");
const https = require("https");
const http = require("http");

const apiCanaryBlueprint = async function () {

  const verifyRequest = async function (requestOption, body = null) {
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
        res.on("end", () => resolve(JSON.parse(body)));
      });

      // Reject on error
      req.on("error", (error) => reject(error));
      req.end();
    });
  };


 // Returns the ISO week of the date.
 const getWeek = function(incomingDate) {
     var date = new Date(incomingDate);
     date.setHours(0, 0, 0, 0);
     // Thursday in current week decides the year.
     date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
     // January 4 is always in week 1.
     var week1 = new Date(date.getFullYear(), 0, 4);
     // Adjust to Thursday in week 1 and count number of weeks from date to week1.
     return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000
                        - 3 + (week1.getDay() + 6) % 7) / 7);
 };

 // Returns Date that corresponds to Monday of the week corresponding to the incoming date
 const getMonday = function(incomingDate) {
     var date = new Date(incomingDate);
     date.setHours(0, 0, 0, 0);
     date.setDate(date.getDate() - (date.getDay() + 6) % 7);
     return date.getDate();
 };

 // Returns Date that corresponds to Sunday of the week corresponding to the incoming date
 const getSunday = function(incomingDate) {
     var date = new Date(incomingDate);
     date.setHours(0, 0, 0, 0);
     date.setDate(date.getDate() + 6 - (date.getDay() + 6) % 7);
     return date.getDate();
 };

 const getFormattedDate = function(incomingDate) {
     var date = new Date(incomingDate);
     var d = date.getDate();
     var m = date.getMonth()+1;
     var y = date.getFullYear();
     var dateString = y + "-" + (m <= 9 ? "0" + m : m) + "-" + (d <= 9 ? "0" + d : d);
     return dateString;
 };

 const testIntegrityForLayer = async function(datasets, layer, operation){
  // TEST #1
  // Find sum of all VIIRS alerts for the most recent completed week in the geostore weekly table
  let sumVIIRSAlerts = 0;
  const currDate = new Date();
  const currYear = currDate.getFullYear();
  const currWeek = getWeek(currDate);
  requestOptions.path = "/v1/query/?sql=select%20sum%28alert__count%29%20as%20sum_alert_count%20from%20" +
    datasets.ViirsGeostoreWeekly + "%20where%20alert__year%20%3D%20" + currYear + "%20and%20and%20alert__week%3D" + currWeek +
    "%20and%20" + layer + operation;
  const responseWDPAWeekly = await verifyRequest(requestOptions);
  //Iterate through each of the rows of the data in the response
  responseWDPAWeekly.data.forEach(row => {
    if (row.sum_alert_count===null) {
      throw new Error("sum of all VIIRS alerts from geostore weekly table not returned");
    }
    else {
        sumVIIRSAlerts = row.sum_alert_count;
        log.info("Successfully returned sum of all VIIRS alerts for the past week from geostore weekly table: " + sumVIIRSAlerts);
    }
  });


  // TEST #2
  // Find sum of all VIIRS alerts for Brazil for the most recent completed week in the geostore daily table
  const lastMonday = new Date();
  log.info("Today’s date = " + getFormattedDate(currDate));
  lastMonday.setDate(getMonday(currDate));
  log.info("Last Monday = " + getFormattedDate(lastMonday));
  log.info("Today = " + getFormattedDate(currDate));
  requestOptions.path = "/v1/query/?sql=select%20sum%28alert__count%29%20as%20sum_alert_count%20from%20" +
    datasets.ViirsGeostoreDaily + "%20where%20alert__date%3E%3D%27" +
    getFormattedDate(lastMonday) + "%27%20and%20alert__date%3C%27" + getFormattedDate(currDate) + "%27" +
    "%20and%20" + layer + operation;
  const responseWDPADaily = await verifyRequest(requestOptions);
  //Iterate through each of the rows of the data in the response
  responseWDPADaily.data.forEach(row => {
    if (row.sum_alert_count===null) {
      throw new Error("sum of all VIIRS alerts from geostore daily table not returned");
    }
    else if (row.sum_alert_count!=sumVIIRSAlerts){
        throw new Error("sum of all VIIRS alerts from geostore daily for the past week is not equal to the sum of all VIIRS alerts from geostore weekly for the past week: " + sumVIIRSAlerts);
    }
    else {
        log.info("Successfully returned sum of all VIIRS alerts for the past week from geostore daily table: " + row.sum_alert_count);
    }
  });
  return sumVIIRSAlerts;
 };


  // Build request options
  let requestOptions = {
    hostname: "staging-api.globalforestwatch.org",
    method: "GET",
    path: "/v1/query/?sql=SELECT%20*%20from%20a4a60110-8465-4f1f-ace1-1be1f3f19446%20limit%201",
    port: 443,
    headers: {
      "User-Agent": synthetics.getCanaryUserAgentString(),
      "Content-Type": "application/json",
    },
  };

  // Find and use secret for auth token
  const secretsManager = new AWS.SecretsManager();
  await secretsManager.getSecretValue({ SecretId: "gfw-api/staging-token" }, function(err, data) {
    if (err) log.info(err, err.stack);
    log.info(data);
    requestOptions.headers["Authorization"] = "Bearer " + JSON.parse(data["SecretString"])["token"];
  }).promise();

  // Find and use secret for hostname
  await secretsManager.getSecretValue({ SecretId: "wri-api/smoke-tests-host" }, function(err, data) {
    if (err) log.info(err, err.stack);
    log.info(data);
    requestOptions.hostname = JSON.parse(data["SecretString"])["smoke-tests-host-staging"];
  }).promise();

  // Find and use datasetid
  let datasets = {
    ViirsWdpaWhitelist: "",
    ViirsWdpaWeekly: "",
    ViirsWdpaDaily: "",
  };
  await secretsManager.getSecretValue({ SecretId: "gfw-api/datasets" }, function(err, data) {
      if (err) log.info(err, err.stack);
      log.info(data);
      datasets.ViirsGeostoreWhitelist = JSON.parse(data["SecretString"])["VIIRS_geostore_whitelist"];
      datasets.ViirsGeostoreWeekly = JSON.parse(data["SecretString"])["VIIRS_geostore_weekly"];
      datasets.ViirsGeostoreDaily = JSON.parse(data["SecretString"])["VIIRS_geostore_daily"];
  }).promise();

  // find and use query parameters
  let contextualLayers = new Map ();
  let contextualLayersString = "";
  await secretsManager.getSecretValue({ SecretId: "gfw-api/smoke-tests-params" }, function(err, data) {
      if (err) log.info(err, err.stack);
      log.info(data);
      contextualLayersString = JSON.parse(data["SecretString"])["whitelist_geostore_contextual_layers"];
      log.info("contextualLayersString: " + contextualLayersString);
      contextualLayers = new Map(JSON.parse(contextualLayersString));
  }).promise();

  requestOptions.path = "/v1/query/?sql=select%20*%20from%20" + datasets.ViirsGeostoreWhitelist;
  const response = await verifyRequest(requestOptions);
  let totalViirsAlertsMap = new Map();
  let totalViirsAlerts = 0;
  //Iterate through each of the rows of the data in the response
  for (const row of response.data) {
    for (const [key, value] of contextualLayers){
        if (totalViirsAlertsMap.get(key)===undefined && row[key]===true){
            totalViirsAlerts = await testIntegrityForLayer(datasets, key, value);
            totalViirsAlertsMap.set(key, totalViirsAlerts);
            log.info("key=" + key + " value=" + value + " row[key]=" + row[key] + " totalViirsAlerts=" + totalViirsAlerts);
        }
    }
  };

  let throwException = false;
  let throwExceptionKeys = "";
  log.info("---------------------------Results:-------------------------------- ")
  for (const [key, value] of totalViirsAlertsMap){
      log.info("key=" + key + " value=" + value );
      if (value === 0){
          throwExceptionKeys = throwExceptionKeys + " " + key;
          throwException = true;
      }
  }
  log.info("----------------------------------------------------------- ")
  if(throwException){
      throw new Error("0 number of alerts returned for the past week across all geostore ids for the following contextuallayers " + throwExceptionKeys);
  }

};


exports.handler = async () => {
  return await apiCanaryBlueprint();
};
