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
      VIIRS_Fire_Alerts_all: "",
      VIIRS_GADM_adm0_weekly: "",
  };
  await secretsManager.getSecretValue({ SecretId: "gfw-api/datasets" }, function(err, data) {
      if (err) log.info(err, err.stack);
      log.info(data);
      datasets.VIIRS_Fire_Alerts_all = JSON.parse(data["SecretString"])["VIIRS_Fire_Alerts_all"];
      datasets.VIIRS_GADM_adm0_weekly = JSON.parse(data["SecretString"])["VIIRS_GADM_adm0_weekly"];
  }).promise();
  
  
  // Retrieve parameters for this smoke test
  let totalVIIRSAlerts=0;
  let totalVIIRSAlertsStartYear='';
  let totalVIIRSAlertsEndYear='';
  await secretsManager.getSecretValue({ SecretId: "gfw-api/smoke-tests-params" }, function(err, data) {
      if (err) log.info(err, err.stack);
      log.info(data);
      totalVIIRSAlerts = JSON.parse(data["SecretString"])["VIIRS_total_count"];
      totalVIIRSAlertsStartYear = JSON.parse(data["SecretString"])["VIIRS_total_count_start_year"];
      totalVIIRSAlertsEndYear = JSON.parse(data["SecretString"])["VIIRS_total_count_end_year"];
  }).promise();

  // TEST #1
  // Find sum of all VIIRS alerts for all historical years from VIIRS Fire Alerts all table
  requestOptions.path = "/v1/query/?sql=select%20sum%28alert__count%29%20as%20sum_alert_count%20from%20" + datasets.VIIRS_Fire_Alerts_all + "%20where%20alert__date%20%3E%3D%20%27" + totalVIIRSAlertsStartYear + "-01-01%27%20and%20alert__date%20%3C%3D%27" + totalVIIRSAlertsEndYear + '-12-31%27';
  const responseAll = await verifyRequest(requestOptions);
  //Iterate through each of the rows of the data in the response
  responseAll.data.forEach(row => {
    if (row.sum_alert_count===null) {
      throw new Error('sum of all VIIRS alerts from \'VIIRS Fire Alerts all\' table not returned');
    }
    else if (row.sum_alert_count!=totalVIIRSAlerts){
        throw new Error('sum of all VIIRS alerts from \'VIIRS Fire Alerts all\' table from ' + totalVIIRSAlertsStartYear + ' to ' + totalVIIRSAlertsEndYear  + ' is ' + row.sum_alert_count + '. Expected value is ' + totalVIIRSAlerts);
    }
    else {
        log.info('Successfully returned sum of all VIIRS alerts from \'VIIRS Fire Alerts all\' table  from ' + totalVIIRSAlertsStartYear + ' to ' + totalVIIRSAlertsEndYear  + ' as '  + totalVIIRSAlerts);
    }
  });  
  
  // TEST #2
  // Find sum of all VIIRS alerts for all historical years from adm0 table
  requestOptions.path = "/v1/query/?sql=select%20sum%28alert__count%29%20as%20sum_alert_count%20from%20" + datasets.VIIRS_GADM_adm0_weekly + "%20where%20alert__year%20%3E%3D%20" + totalVIIRSAlertsStartYear + "%20and%20alert__year%20%3C%3D" + totalVIIRSAlertsEndYear;
  const responseAdm0 = await verifyRequest(requestOptions);
  //Iterate through each of the rows of the data in the response
  responseAdm0.data.forEach(row => {
    if (!row.sum_alert_count) {
      throw new Error('sum of all VIIRS alerts from \'VIIRS GADM adm0\' table  table not returned');
    }
    else if (row.sum_alert_count!=totalVIIRSAlerts){
        throw new Error('sum of all VIIRS alerts from \'VIIRS GADM adm0\' from ' + totalVIIRSAlertsStartYear + ' to ' + totalVIIRSAlertsEndYear  + ' is ' + row.sum_alert_count + '. Expected value is ' + totalVIIRSAlerts);
    }
    else {
        log.info('Successfully returned sum of all VIIRS alerts from \'VIIRS GADM adm0\' from ' + totalVIIRSAlertsStartYear + ' to ' + totalVIIRSAlertsEndYear  + ' as '  + totalVIIRSAlerts);
    }
  });  
  
};

exports.handler = async () => {
  return await apiCanaryBlueprint();
};
