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
        res.on("end", () => { resolve(JSON.parse(body)); });
      });

      // Reject on error
      req.on("error", (error) => reject(error));
      req.end();
    });
  }


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
 }

 // Returns Date that corresponds to Monday of the week corresponding to the incoming date
 const getMonday = function(incomingDate) {
     var date = new Date(incomingDate);
     date.setHours(0, 0, 0, 0);
     date.setDate(date.getDate() - (date.getDay() + 6) % 7);
     return date;
 }


 const getFormattedDate = function(incomingDate) {
     var date = new Date(incomingDate);
     var d = date.getDate();
     var m = date.getMonth()+1;
     var y = date.getFullYear();
     var dateString = y + "-" + (m <= 9 ? "0" + m : m) + "-" + (d <= 9 ? "0" + d : d);
     return dateString;
 }

 log.info("Building request options");

  // Build request options for WRI API
  let requestOptions = {
    hostname: "production-api.globalforestwatch.org",
    method: "GET",
    path: "/v1/query/?sql=SELECT%20*%20from%20a4a60110-8465-4f1f-ace1-1be1f3f19446%20limit%201",
    port: 443,
    headers: {
      "User-Agent": synthetics.getCanaryUserAgentString(),
      "Content-Type": "application/json",
    },
  };

  // Build request options for GFW DATA API
  let requestOptionsDataApi = {
    hostname: "data-api.globalforestwatch.org",
    method: "GET",
    path: "/dataset/nasa_viirs_fire_alerts/latest/query?sql=select%20*%20from%20mytable%20limit%201",
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
    requestOptions.headers["Authorization"] = "Bearer " + JSON.parse(data["SecretString"])["token"];
    requestOptionsDataApi.headers["Authorization"] = "Bearer " + JSON.parse(data["SecretString"])["token"];
  }).promise();


  // Find and use secret for hostname
  await secretsManager.getSecretValue({ SecretId: "wri-api/smoke-tests-host" }, function(err, data) {
    if (err) log.info(err, err.stack);
    log.info(data);
    requestOptions.hostname = JSON.parse(data["SecretString"])["smoke-tests-host-production"];
    requestOptionsDataApi.hostname = JSON.parse(data["SecretString"])["smoke-tests-host-data-api"];
  }).promise();


  // Find and use datasetid
  let datasets = {
      VIIRS_Fire_Alerts_all: "",
      VIIRS_GADM_adm0_weekly: "",
      VIIRS_Data_Api_Name: "",
      VIIRS_Data_Api_Version: "",
  };
  await secretsManager.getSecretValue({ SecretId: "gfw-api/datasets" }, function(err, data) {
      if (err) log.info(err, err.stack);
      log.info(data);
      datasets.VIIRS_Fire_Alerts_all = JSON.parse(data["SecretString"])["VIIRS_Fire_Alerts_all"];
      datasets.VIIRS_GADM_adm0_weekly = JSON.parse(data["SecretString"])["VIIRS_GADM_adm0_weekly"];
      datasets.VIIRS_Data_Api_Name = JSON.parse(data["SecretString"])["VIIRS_Data_Api_Name"];
      datasets.VIIRS_Data_Api_Version = JSON.parse(data["SecretString"])["VIIRS_Data_Api_Version"];
  }).promise();


  // Retrieve parameters for this smoke test
  let totalVIIRSAlerts=0;
  await secretsManager.getSecretValue({ SecretId: "gfw-api/smoke-tests-params" }, function(err, data) {
      if (err) log.info(err, err.stack);
      log.info(data);
  }).promise();

  // TEST #1
  // Find sum of all VIIRS alerts for the past week from VIIRS Fire Alerts all table
  const currDate = new Date();
  log.info("Today’s date = " + getFormattedDate(currDate));
  const lastMonday = new Date(getMonday(currDate));
  log.info("Last Monday = " + getFormattedDate(lastMonday));
  log.info("Today = " + getFormattedDate(currDate));
  requestOptions.path = "/v1/query/?sql=select%20sum%28alert__count%29%20as%20sum_alert_count%20from%20" + datasets.VIIRS_Fire_Alerts_all + "%20where%20alert__date%20%3E%3D%20%27" + getFormattedDate(lastMonday)  + "%27%20and%20alert__date%20%3C%27" + getFormattedDate(currDate) + "%27";
  const responseAll = await verifyRequest(requestOptions);
  //Iterate through each of the rows of the data in the response
  responseAll.data.forEach(row => {
    if (row.sum_alert_count===null) {
      throw new Error("sum of all VIIRS alerts from \"VIIRS Fire Alerts all\" table for the past week not returned");
    }
    else if (row.sum_alert_count===0) {
      throw new Error("sum of all VIIRS alerts from \"VIIRS Fire Alerts all\" table for the past week is 0");
    }
    else {
        totalVIIRSAlerts = row.sum_alert_count;
        log.info("Successfully returned sum of all VIIRS alerts from \"VIIRS Fire Alerts all\" table for the past week: " + totalVIIRSAlerts);
    }
  });

  // TEST #2
  // Find sum of all VIIRS alerts for the past week from adm0 table
  const currYear = currDate.getFullYear();
  const currWeek = getWeek(currDate);
  log.info("current week:" + currWeek);
  requestOptions.path = "/v1/query/?sql=select%20sum%28alert__count%29%20as%20sum_alert_count%20from%20" + datasets.VIIRS_GADM_adm0_weekly + "%20where%20alert__year%20%3D%20" + currYear + "%20and%20alert__week%20%3D" + currWeek;
  const responseAdm0 = await verifyRequest(requestOptions);
  //Iterate through each of the rows of the data in the response
  responseAdm0.data.forEach(row => {
    if (!row.sum_alert_count) {
      throw new Error("sum of all VIIRS alerts from \"VIIRS GADM adm0\" table for the past week not returned");
    }
    else if (row.sum_alert_count!=totalVIIRSAlerts){
        throw new Error("sum of all VIIRS alerts from \"VIIRS GADM adm0\" for the past week from "  + " is " + row.sum_alert_count + ". Expected value is " + totalVIIRSAlerts);
    }
    else {
        log.info("Successfully returned sum of all VIIRS alerts from \"VIIRS GADM adm0\" for the past week: " + totalVIIRSAlerts);
    }
  });

  // TEST #3
  // Count all alerts for the past week from the vector tile cache
  requestOptionsDataApi.path = "/dataset/" + datasets.VIIRS_Data_Api_Name + "/" + datasets.VIIRS_Data_Api_Version + "/query?sql=select%20count%28*%29%20as%20sum_alert_count%20from%20mytable%20where%20alert__date%20%3E%3D%20%27" + getFormattedDate(lastMonday)  + "%27%20and%20alert__date%20%3C%27" + getFormattedDate(currDate) + "%27";
 // log.info("Making request with options: " + JSON.stringify(requestOptionsDataApi));
 const responseDataApi = await verifyRequest(requestOptionsDataApi);
  //Iterate through each of the rows of the data in the response
responseDataApi.data.forEach(row => {
    if (row.sum_alert_count===null) {
      throw new Error("count of all VIIRS alerts from " + datasets.VIIRS_Data_Api_Name + "/" + datasets.VIIRS_Data_Api_Version + " GFW DATA API dataset for the past week not returned");
    }
    else if (row.sum_alert_count===0) {
      throw new Error("count of all VIIRS alerts from " + datasets.VIIRS_Data_Api_Name + "/" + datasets.VIIRS_Data_Api_Version + " GFW DATA API dataset for the past week is 0");
    }
    else if (row.sum_alert_count!=totalVIIRSAlerts){
        throw new Error("count of all VIIRS alerts from "  + datasets.VIIRS_Data_Api_Name + "/" + datasets.VIIRS_Data_Api_Version + " GFW DATA API dataset for the past week "  + " is " + row.sum_alert_count + ". Expected value is " + totalVIIRSAlerts);
    }
    else {
        log.info("Successfully returned count of all VIIRS alerts from "  + datasets.VIIRS_Data_Api_Name + "/" + datasets.VIIRS_Data_Api_Version +  " GFW DATA API dataset for the past week: " + totalVIIRSAlerts);
    }
  });

};

exports.handler = async () => {
  return await apiCanaryBlueprint();
};