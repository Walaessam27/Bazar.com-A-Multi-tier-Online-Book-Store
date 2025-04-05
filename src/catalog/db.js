const DatabaseConfig = require('./DatabaseConfig');


DatabaseConfig.createCatalogTable();
DatabaseConfig.insertIntoCatalog('How to get a good grade in DOS in 40 minutes a day',100,'Distributed systems',2);
DatabaseConfig.insertIntoCatalog('RPCs for Noobs',200,'Distributed systems',3);
DatabaseConfig.insertIntoCatalog('Xen and the Art of Surviving Undergraduate School',99,'Undergraduate school',4);
DatabaseConfig.insertIntoCatalog('Cooking for the Impatient Undergrad',20,'Undergraduate school',5);