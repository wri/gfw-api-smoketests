# gfw-api-smoketests
Smoke tests for gfw api endpoints.
All of these tests are run using AWS Canaries.

To access status of the tests, login to AWS GFW Production Account and navigate to <https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#synthetics:canary/list>.

## VIIRS and MODIS tests ensure that fires data is consistent across all datasets after daily runs 

-  Sum of all VIIRS alerts for all complete years (2012-2019) from 'VIIRS Fire Alerts all' and 'VIIRS Fire Alerts adm0 weekly' tables are equal to the official count stored in the properties table
-  Sum of all VIIRS alerts for the most recent week from 'VIIRS Fire Alerts all' is equal to the number from the 'VIIRS Fire Alerts adm0 weekly' table 
-  Sum of all VIIRS alerts for the most recent week is the same across all admin tables: 'VIIRS Fire Alerts adm0 weekly', 'VIIRS Fire Alerts adm1 weekly', 'VIIRS Fire Alerts adm2 weekly', 'VIIRS Fire Alerts adm2 daily'
-  Sum of all VIIRS alerts for the most recent week is the same across all wdpa tables: 'VIIRS WDPA daily', 'VIIRS WDPA weekly'
-  Sum of all VIIRS alerts for the most recent week is the same across all geostore tables: 'VIIRS geostore weekly', 'VIIRS geostore daily'
-  Sum of all MODIS alerts for all complete years (2001-2019) from 'MODIS Fire Alerts adm0 weekly' table is equal to the official count stored in the properties table
-  Sum of all MODIS alerts for the most recent week is the same across all admin tables: 'MODIS Fire Alerts adm0 weekly', 'MODIS Fire Alerts adm1 weekly', 'MODIS Fire Alerts adm2 weekly', 'MODIS Fire Alerts adm2 daily'
-  Sum of all MODIS alerts for the most recent week is the same across all wdpa tables: 'MODIS WDPA daily', 'MODIS WDPA weekly'
-  Sum of all MODIS alerts for the most recent week is the same across all geostore tables: 'MODIS geostore weekly', 'MODIS geostore daily'
