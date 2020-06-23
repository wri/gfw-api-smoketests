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
     return date.getDate();
 }

 // Returns Date that corresponds to Sunday of the week corresponding to the incoming date
 const getSunday = function(incomingDate) {
     var date = new Date(incomingDate);
     date.setHours(0, 0, 0, 0);
     date.setDate(date.getDate() + 6 - (date.getDay() + 6) % 7);
     return date.getDate();
 }

 const getFormattedDate = function(incomingDate) {
     var date = new Date(incomingDate);
     var d = date.getDate();
     var m = date.getMonth()+1;
     var y = date.getFullYear();
     var dateString = y + "-" + (m <= 9 ? "0" + m : m) + "-" + (d <= 9 ? "0" + d : d);
     return dateString;
 }

 const testIntegrityForLayer = function(datasets, countryISO, layer){
    // TEST #1
    // Find sum of all VIIRS alerts for the most recent completed week in the adm0 table
    let sumVIIRSAlerts = 0;
    const currDate = new Date();
    const currYear = currDate.getFullYear();
    const currWeek = getWeek(currDate);
    log.info("current week:" + currWeek);
    requestOptions.path = "/v1/query/?sql=select%20sum%28alert__count%29%20as%20sum_alert_count%20from%20" + 
        datasets.ViirsGadmAdm0Weekly + "%20where%20alert__year%20%3D%20" + currYear + "%20and%20alert__week%3D" + 
        currWeek + "%20and%20iso%3D%20%27" + countryISO + "%27%20and%20" + layer + "%20%3D%20%27true%27";
    const responseAdm0 = await verifyRequest(requestOptions);
    //Iterate through each of the rows of the data in the response
    responseAdm0.data.forEach(row => {
        if (row.sum_alert_count===null) {
            throw new Error("sum of all VIIRS alerts from adm0 weekly table not returned");
        }
        else if (row.sum_alert_count===0){
            throw new Error("sum of all VIIRS alerts from adm0 weekly for the past  week is 0");
        }
        else {
            sumVIIRSAlerts = row.sum_alert_count;
            log.info("Successfully returned sum of all VIIRS alerts for the past week for rom adm0 weekly table: " + sumVIIRSAlerts);
        }
    });


    // TEST #2
    // Find sum of all VIIRS alerts for the most recent  week in the adm1 table
    requestOptions.path = "/v1/query/?sql=select%20sum%28alert__count%29%20as%20sum_alert_count%20from%20" + 
        datasets.ViirsGadmAdm1Weekly + "%20where%20alert__year%20%3D%20" + currYear + "%20and%20and%20alert__week%3D" + 
        currWeek + "%20and%20iso%3D%20%27" + countryISO + "%27%20and%20" + layer + "%20%3D%20%27true%27";
    const responseAdm1 = await verifyRequest(requestOptions);
    //Iterate through each of the rows of the data in the response
    responseAdm1.data.forEach(row => {
        if (!row.sum_alert_count) {
            throw new Error("sum of all VIIRS alerts from adm1 weekly table not returned");
        }
        else if (row.sum_alert_count!=sumVIIRSAlerts){
            throw new Error("sum of all VIIRS alerts from adm1 weekly for the past week " + row.sum_alert_count + " is not equal to the sum of all VIIRS alerts from adm0 weekly for the past week: " + sumVIIRSAlerts);
        }
        else {
            log.info("Successfully returned sum of all VIIRS alerts for the past week from adm1 weekly table: " + row.sum_alert_count);
        }
    });

    // TEST #3
    // Find sum of all VIIRS alerts for the most recent week in the adm2 table
    requestOptions.path = "/v1/query/?sql=select%20sum%28alert__count%29%20as%20sum_alert_count%20from%20" + 
        datasets.ViirsGadmAdm2Weekly + "%20where%20alert__year%20%3D%20" + currYear + "%20and%20and%20alert__week%3D" + 
        currWeek + "%20and%20iso%3D%20%27" + countryISO + "%27%20and%20" + layer + "%20%3D%20%27true%27";
    const responseAdm2 = await verifyRequest(requestOptions);
    //Iterate through each of the rows of the data in the response
    responseAdm2.data.forEach(row => {
        if (!row.sum_alert_count) {
            throw new Error("sum of all VIIRS alerts from adm2 weekly table not returned");
        }
        else if (row.sum_alert_count!=sumVIIRSAlerts){
            throw new Error("sum of all VIIRS alerts from adm2 weekly for the past week " + row.sum_alert_count + " is not equal to the sum of all VIIRS alerts from adm0 weekly for the past week: " + sumVIIRSAlerts);
        }
        else {
            log.info("Successfully returned sum of all VIIRS alerts for the past week from adm2 weekly table: " + row.sum_alert_count);
        }
    });

    // TEST #4
    // Find sum of all VIIRS alerts for the most recent week in the adm2 daily table
    const lastMonday = new Date();
    log.info("Today’s date = " + getFormattedDate(currDate));
    lastMonday.setDate(getMonday(currDate));
    log.info("Last Monday = " + getFormattedDate(lastMonday));
    log.info("Today = " + getFormattedDate(currDate));
    requestOptions.path = "/v1/query/?sql=select%20sum%28alert__count%29%20as%20sum_alert_count%20from%20" + 
        datasets.ViirsGadmAdm2Daily + "%20where%20and%20alert__date%20%3E%3D%27" + 
        getFormattedDate(lastMonday) + "%27%20and%20alert__date%3C%27" + getFormattedDate(currDate) + "%27" + 
        "%20and%20iso%3D%20%27" + countryISO + "%27%20and%20" + layer + "%20%3D%20%27true%27";
    const responseAdm2Daily = await verifyRequest(requestOptions);
    //Iterate through each of the rows of the data in the response
    responseAdm2Daily.data.forEach(row => {
        if (!row.sum_alert_count) {
            throw new Error("sum of all VIIRS alerts from adm2 daily table not returned");
        }
        else if (row.sum_alert_count!=sumVIIRSAlerts){
            throw new Error("sum of all VIIRS alerts from adm2 daily for the past week " + row.sum_alert_count + " is not equal to the sum of all VIIRS alerts from adm0 weekly for the past week: " + sumVIIRSAlerts);
        }
        else {
            log.info("Successfully returned sum of all VIIRS alerts for the past week from adm2 daily table: " + row.sum_alert_count);
        }
    });
 }

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
    ViirsGadmAdm0Whitelist: "",
    ViirsGadmAdm0Weekly: "",
    ViirsGadmAdm1Weekly: "",
    ViirsGadmAdm2Weekly: "",
    ViirsGadmAdm2Daily: "",
  };
  await secretsManager.getSecretValue({ SecretId: "gfw-api/datasets" }, function(err, data) {
      if (err) log.info(err, err.stack);
      log.info(data);
      datasets.ViirsGadmAdm0Whitelist = JSON.parse(data["SecretString"])["VIIRS_GADM_adm0_whitelist"];
      datasets.ViirsGadmAdm0Weekly = JSON.parse(data["SecretString"])["VIIRS_GADM_adm0_weekly"];
      datasets.ViirsGadmAdm1Weekly = JSON.parse(data["SecretString"])["VIIRS_GADM_adm1_weekly"];
      datasets.ViirsGadmAdm2Weekly = JSON.parse(data["SecretString"])["VIIRS_GADM_adm2_weekly"];
      datasets.ViirsGadmAdm2Daily = JSON.parse(data["SecretString"])["VIIRS_GADM_adm2_daily"];
  }).promise();

  // find and use query parameters
  let countriesISOCodes = "";
  await secretsManager.getSecretValue({ SecretId: "gfw-api/smoke-tests-params" }, function(err, data) {
      if (err) log.info(err, err.stack);
      log.info(data);
      countriesISOCodes = JSON.parse(data["SecretString"])["whitelist_test_countries_ISO_codes"];
  }).promise();

  requestOptions.path = "/v1/query/?sql=select%20*%20from%20" +
    datasets.ViirsGadmAdm0Whitelist + "%20where%20iso%20in%20%28" + countriesISOCodes + "%29";
  const responseAdm0 = await verifyRequest(requestOptions);
  //Iterate through each of the rows of the data in the response
  responseAdm0.data.forEach(row => {
    if (row.iso===null) {
        throw new Error("no entry returned from Viirs Adm0 Whitelist table");
    }
    else {
        if (row.wdpa_protected_area__iucn_cat==="true") testIntegrityForLayer(datasets, row.iso, "wdpa_protected_area__iucn_cat");
        if (row.is__umd_regional_primary_forest_2001)==="true")testIntegrityForLayer(datasets, row.iso, "is__umd_regional_primary_forest_2001");
        if (row.is__birdlife_alliance_for_zero_extinction_site==="true") testIntegrityForLayer(datasets, row.iso, "is__birdlife_alliance_for_zero_extinction_site");
        if (row.is__birdlife_key_biodiversity_area==="true")testIntegrityForLayer(datasets, row.iso, "is__birdlife_key_biodiversity_area");
        if (row.is__landmark_land_right==="true")testIntegrityForLayer(datasets, row.iso, "is__landmark_land_right");
        if (row.gfw_plantation__type==="true") testIntegrityForLayer(datasets, row.iso, "gfw_plantation__type");
        if (row.is__gfw_mining==="true") testIntegrityForLayer(datasets, row.iso, "is__gfw_mining");
        if (row.is__gfw_managed_forest==="true") testIntegrityForLayer(datasets, row.iso, "is__gfw_managed_forest");
        if (row.rspo_oil_palm__certification_status) testIntegrityForLayer(datasets, row.iso, "rspo_oil_palm__certification_status");
        if (row.is__gfw_wood_fiber==="true") testIntegrityForLayer(datasets, row.iso, "is__gfw_wood_fiber");
        if (row.is__peatland)==="true") testIntegrityForLayer(datasets, row.iso, "is__peatland");
        if (row.is__idn_forest_moratorium==="true")testIntegrityForLayer(datasets, row.iso, "is__idn_forest_moratorium");
        if (row.is__gfw_oil_palm==="true") testIntegrityForLayer(datasets, row.iso, "is__gfw_oil_palm");
        if (row.idn_forest_area__type) testIntegrityForLayer(datasets, row.iso, "idn_forest_area__type");
        if (row.per_forest_concession__type==="true") testIntegrityForLayer(datasets, row.iso, "per_forest_concession__type");
        if (row.is__gfw_oil_gas==="true") testIntegrityForLayer(datasets, row.iso, "is__gfw_oil_gas");
        if (row.is__gmw_mangroves_2016==="true") testIntegrityForLayer(datasets, row.iso, "is__gmw_mangroves_2016");
        if (row.is__ifl_intact_forest_landscape_2016) testIntegrityForLayer(datasets, row.iso, "is__ifl_intact_forest_landscape_2016");
        if (row.bra_biome__name==="true") testIntegrityForLayer(datasets, row.iso, "bra_biome__name");
    }
  });
};

exports.handler = async () => {
  return await apiCanaryBlueprint();
};
