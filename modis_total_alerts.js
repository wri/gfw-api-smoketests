const synthetics = require('Synthetics');
const log = require('SyntheticsLogger');
const AWS = require('aws-sdk');
const https = require('https');
const http = require('http');

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
      req.on('response', (res) => {
        log.info(`Status Code: ${res.statusCode}`)

        // Assert the status code returned
        if (res.statusCode !== 200) {
          reject("Failed: " + requestOption.path + " with status code " + res.statusCode + " Making request with options: " + JSON.stringify(requestOption));
        }

        // Grab body chunks and piece returned body together
        let body = '';
        res.on('data', (chunk) => { body += chunk.toString(); });

        // Resolve providing the returned body
        res.on('end', () => resolve(JSON.parse(body)));
      });

      // Reject on error
      req.on('error', (error) => reject(error));
      req.end();
    });
  }

  // Build request options
  let requestOptions = {
    hostname: "staging-api.globalforestwatch.org",
    method: "GET",
    path: "/v1/query/?sql=SELECT%20*%20from%20a4a60110-8465-4f1f-ace1-1be1f3f19446%20limit%201",
    port: 443,
    headers: {
      'User-Agent': synthetics.getCanaryUserAgentString(),
      'Content-Type': 'application/json',
    },
  };

  // Find and use secret for auth token
  const secretsManager = new AWS.SecretsManager();
  await secretsManager.getSecretValue({ SecretId: "gfw-api/staging-token" }, function(err, data) {
    if (err) log.info(err, err.stack);
    log.info(data);
    requestOptions.headers['Authorization'] = "Bearer " + JSON.parse(data["SecretString"])["token"];
  }).promise();

  // Find and use secret for hostname
  await secretsManager.getSecretValue({ SecretId: "wri-api/smoke-tests-host" }, function(err, data) {
    if (err) log.info(err, err.stack);
    log.info(data);
    requestOptions.hostname = JSON.parse(data["SecretString"])["smoke-tests-host-staging"];
  }).promise();

  
  
  // Find and use datasetid
  let datasets = {
      MODIS_Fire_Alerts_adm0_weekly: "",
  };
  await secretsManager.getSecretValue({ SecretId: "gfw-api/datasets" }, function(err, data) {
      if (err) log.info(err, err.stack);
      log.info(data);
      datasets.MODIS_Fire_Alerts_adm0_weekly = JSON.parse(data["SecretString"])["MODIS_Fire_Alerts_adm0_weekly"];
  }).promise();
  
  
  // Retrieve parameters for this smoke test
  let totalMODISAlerts=0;
  let totalMODISAlertsStartYear='';
  let totalMODISAlertsEndYear='';
  await secretsManager.getSecretValue({ SecretId: "gfw-api/smoke-tests-params" }, function(err, data) {
      if (err) log.info(err, err.stack);
      log.info(data);
      totalMODISAlerts = JSON.parse(data["SecretString"])["MODIS_total_count"];
      totalMODISAlertsStartYear = JSON.parse(data["SecretString"])["MODIS_total_count_start_year"];
      totalMODISAlertsEndYear = JSON.parse(data["SecretString"])["MODIS_total_count_end_year"];
  }).promise();

  
  // TEST #1
  // Find sum of all MODIS alerts for all historical years from adm0 table
  requestOptions.path = "/v1/query/?sql=select%20sum%28alert__count%29%20as%20sum_alert_count%20from%20" + datasets.MODIS_Fire_Alerts_adm0_weekly + "%20where%20alert__year%20%3E%3D%20" + totalMODISAlertsStartYear + "%20and%20alert__year%20%3C%3D" + totalMODISAlertsEndYear;
  const responseAdm0 = await verifyRequest(requestOptions);
  //Iterate through each of the rows of the data in the response
  responseAdm0.data.forEach(row => {
    if (!row.sum_alert_count) {
      throw new Error('sum of all MODIS alerts from \'MODIS GADM adm0\' table  table not returned');
    }
    else if (row.sum_alert_count!=totalMODISAlerts){
        throw new Error('sum of all MODIS alerts from \'MODIS GADM adm0\' from ' + totalMODISAlertsStartYear + ' to ' + totalMODISAlertsEndYear  + ' is ' + row.sum_alert_count + '. Expected value is ' + totalMODISAlerts);
    }
    else {
        log.info('Successfully returned sum of all MODIS alerts from \'MODIS GADM adm0\' from ' + totalMODISAlertsStartYear + ' to ' + totalMODISAlertsEndYear  + ' as '  + totalMODISAlerts);
    }
  });  
  
};

exports.handler = async () => {
  return await apiCanaryBlueprint();
};
