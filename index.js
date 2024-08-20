const express = require('express');
const mysql = require('mysql2/promise');
const NodeCache = require('node-cache');

const app = express();


const dbConfig = {
  host: 'e2ecommify-do-user-13942022-0.c.db.ondigitalocean.com',
  user: 'report',
  password: 'E2e@365nalytics',
  database: 'e2e_database',
  port: 25060
};

const db = mysql.createPool(dbConfig);

const cache = new NodeCache({ stdTTL: 86400, checkperiod: 87000 }); // Cache for 1 day

const fetchDataAndCache = async () => {
  try {
    console.log('Fetching data from MySQL server to cache...');
    
    const [salesValueRows] = await db.execute("SELECT sum(`UninvoicedValue`) as total FROM `SalesFulfilmentReport` INNER JOIN `SalesOrderExport` ON SalesOrderExport.`So`=`SalesFulfilmentReport`.`So` WHERE `CreatedDate` LIKE '%2024%';");
    cache.set('salesvalue', salesValueRows[0].total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    console.log('Cached sales value data.');

    const [soldUnitsRows] = await db.execute("SELECT sum(`Uninvoiced`) as total FROM `SalesFulfilmentReport` INNER JOIN `SalesOrderExport` ON SalesOrderExport.`So`=`SalesFulfilmentReport`.`So` WHERE `CreatedDate` LIKE '%2024%';");
    cache.set('soldunits', soldUnitsRows[0].total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    console.log('Cached sold units data.');

    const [salesChannelsRows] = await db.execute("SELECT SalesFulfilmentReport.customer, YEAR(SalesOrderExport.CreatedDate) AS year, COUNT(SalesFulfilmentReport.Sku) AS sales FROM SalesFulfilmentReport INNER JOIN SalesOrderExport ON SalesOrderExport.So = SalesFulfilmentReport.So GROUP BY SalesFulfilmentReport.Customer, YEAR(SalesOrderExport.CreatedDate);");
    cache.set('saleschannels', salesChannelsRows);
    console.log('Cached sales channels data.');

    const [streamRows] = await db.execute("SELECT DATE(so.CreatedDate) AS Date, SUM(CASE WHEN sod.Customer LIKE '%Amazon%' THEN calc.total_price ELSE 0 END) AS Amazon, SUM(CASE WHEN sod.Customer LIKE '%Ebay%' THEN calc.total_price ELSE 0 END) AS Ebay, SUM(CASE WHEN sod.Customer LIKE '%OnBuy%' THEN calc.total_price ELSE 0 END) AS OnBuy, SUM(CASE WHEN sod.Customer LIKE '%Cheerful%' THEN calc.total_price ELSE 0 END) AS CheerfulBargains, SUM(CASE WHEN sod.Customer LIKE '%Wayfair%' THEN calc.total_price ELSE 0 END) AS Wayfair, SUM(CASE WHEN sod.Customer LIKE '%XmasHub%' THEN calc.total_price ELSE 0 END) AS 'XmasHub.co.uk', SUM(CASE WHEN sod.Customer LIKE '%Wowcher%' THEN calc.total_price ELSE 0 END) AS Wowcher, SUM(CASE WHEN sod.Customer LIKE '%YourWedding%' THEN calc.total_price ELSE 0 END) AS YourWeddingBoutique, SUM(CASE WHEN sod.Customer IS NOT NULL AND sod.Customer NOT LIKE '%Amazon%' AND sod.Customer NOT LIKE '%Ebay%' AND sod.Customer NOT LIKE '%OnBuy%' AND sod.Customer NOT LIKE '%Cheerful%' AND sod.Customer NOT LIKE '%Wayfair%' AND sod.Customer NOT LIKE '%XmasHub%' AND sod.Customer NOT LIKE '%Wowcher%' AND sod.Customer NOT LIKE '%YourWedding%' THEN calc.total_price ELSE 0 END) AS 'Others' FROM SalesOrderExport so JOIN SalesOrderExportDetails sod ON so.So = sod.SO JOIN InventoryDetailsMw id ON sod.SKU = id.SKU JOIN (SELECT sod.SKU, sod.SO, (sod.QtyConfirmed * id.SellPrice) AS total_price FROM SalesOrderExportDetails sod JOIN InventoryDetailsMw id ON sod.SKU = id.SKU) calc ON sod.SO = calc.SO AND sod.SKU = calc.SKU WHERE so.CreatedDate BETWEEN '2023-01-01' AND '2023-12-31' GROUP BY DATE(so.CreatedDate) ORDER BY Date;");
    cache.set('stream', streamRows);
    console.log('Cached stream data.');

    const [scatterplotRows] = await db.execute("SELECT OnHand AS inventory,SellPrice * OnHand AS sales,(SellPrice - BuyingPrice) * OnHand AS profit,SKU AS product,Department AS category,Vendor AS department FROM  `InventoryDetailsMw` ORDER BY  OnHand DESC;");
    cache.set('scatterplot', scatterplotRows);
    console.log('Cached scatterplot data.');

    const [chordRows] = await db.execute("SELECT i.SKU, i.Title AS ProductTitle, soe.Customer, i.Warehouse, COUNT(DISTINCT soe.So) AS OrderCount, SUM(soed.QtyConfirmed) AS TotalQuantitySold FROM InventoryDetailsMw i JOIN SalesOrderExportDetails soed ON i.SKU = soed.SKU JOIN SalesOrderExport soe ON soed.SO = soe.So WHERE soe.CreatedDate >= DATE_SUB(CURDATE(), INTERVAL 1 YEAR) GROUP BY i.SKU, i.Title, soe.Customer, i.Warehouse HAVING TotalQuantitySold > 0 ORDER BY TotalQuantitySold DESC;");
    cache.set('chord', chordRows);
    console.log('Cached chord data.');

    const [inventoryRows] = await db.execute("SELECT OnHand AS inventory, SKU AS sku,Title AS title,Department AS category,OnHand AS onHand,Available AS available,Reserved AS reserved,Vendor AS warehouse,BuyingPrice AS buyingPrice,SellPrice AS sellPrice,SellPrice * OnHand AS sales,(SellPrice - BuyingPrice) * OnHand AS profit,SKU AS product,Department AS category FROM  `InventoryDetailsMw` ORDER BY  OnHand DESC ;");
    cache.set('inventory', inventoryRows);
    console.log('Cached inventory data.');

    const [salesTableRows] = await db.execute("SELECT `SalesOrderExport`.`Customer`,`SalesFulfilmentReport`.`Sku`,`SalesFulfilmentReport`.`Title`,`SalesFulfilmentReport`.`Vendor`,`SalesFulfilmentReport`.`Id`,`SalesFulfilmentReport`.`So`,`SalesOrderExport`.`Type`,`SalesOrderExport`.`CreatedDate`,`SalesOrderExport`.`ShippingState`,`SalesOrderExport`.`Po`,`ShippingEmail`,`Warehouse`,`Carrier`,`CustomerCode` FROM `SalesFulfilmentReport` INNER JOIN `SalesOrderExport` ON SalesOrderExport.`So`=`SalesFulfilmentReport`.`So` ORDER BY `CreatedDate` DESC LIMIT 100;");
    cache.set('salestable', salesTableRows);
    console.log('Cached sales table data.');

    const [salesFulfilmentRows] = await db.execute("SELECT SalesFulfilmentReport.customer, DATE(`SalesOrderExport`.CreatedDate) AS date, COUNT(SalesFulfilmentReport.Sku) AS sales, `SalesOrderExport`.`Carrier` AS platform, `SalesOrderExport`.`ShippingCountry` AS country, `SalesOrderExport`.`Warehouse` AS warehouse, `SalesOrderExport`.`Origin` AS category FROM SalesFulfilmentReport INNER JOIN SalesOrderExport ON SalesOrderExport.So = SalesFulfilmentReport.So GROUP BY SalesFulfilmentReport.Customer, SalesOrderExport.CreatedDate, `SalesOrderExport`.`Carrier`, `SalesOrderExport`.`ShippingCountry`, `SalesOrderExport`.`Warehouse`, `SalesOrderExport`.`Origin` ORDER BY `SalesOrderExport`.`CreatedDate` DESC LIMIT 100;");
    cache.set('salesfulfilment', salesFulfilmentRows);
    console.log('Cached sales fulfilment data.');

  } catch (err) {
    console.error('Error fetching data from MySQL:', err);
  }
};

// CORS settings
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Schedule cache refresh every 24 hours (1 day)
setInterval(fetchDataAndCache, 86400000); // 24 hours in milliseconds

// Initial cache fill
fetchDataAndCache();

// API endpoints using the cache
app.get('/api/salesvalue', (req, res) => {
  const cachedData = cache.get('salesvalue');
  if (cachedData) {
    console.log('Returning cached sales value data.');
    return res.json(cachedData);
  } else {
    console.log('No cached data for sales value.');
    res.status(500).json({ message: 'Error fetching data' });
  }
});

app.get('/api/soldunits', (req, res) => {
  const cachedData = cache.get('soldunits');
  if (cachedData) {
    console.log('Returning cached sold units data.');
    return res.json(cachedData);
  } else {
    console.log('No cached data for sold units.');
    res.status(500).json({ message: 'Error fetching data' });
  }
});

app.get('/api/saleschannels', (req, res) => {
  const cachedData = cache.get('saleschannels');
  if (cachedData) {
    console.log('Returning cached sales channels data.');
    return res.json(cachedData);
  } else {
    console.log('No cached data for sales channels.');
    res.status(500).json({ message: 'Error fetching data' });
  }
});

app.get('/api/salesreport/stream', (req, res) => {
  const cachedData = cache.get('stream');
  if (cachedData) {
    console.log('Returning cached stream data.');
    return res.json(cachedData);
  } else {
    console.log('No cached data for stream.');
    res.status(500).json({ message: 'Error fetching data' });
  }
});

app.get('/api/salesreport/scatterplot', (req, res) => {
  const cachedData = cache.get('scatterplot');
  if (cachedData) {
    console.log('Returning cached scatterplot data.');
    return res.json(cachedData);
  } else {
    console.log('No cached data for scatterplot.');
    res.status(500).json({ message: 'Error fetching data' });
  }
});

app.get('/api/salesreport/chord', (req, res) => {
  const cachedData = cache.get('chord');
  if (cachedData) {
    console.log('Returning cached chord data.');
    return res.json(cachedData);
  } else {
    console.log('No cached data for chord.');
    res.status(500).json({ message: 'Error fetching data' });
  }
});

app.get('/api/inventory', (req, res) => {
  const cachedData = cache.get('inventory');
  if (cachedData) {
    console.log('Returning cached inventory data.');
    return res.json(cachedData);
  } else {
    console.log('No cached data for inventory.');
    res.status(500).json({ message: 'Error fetching data' });
  }
});

app.get('/api/salestable', (req, res) => {
  const cachedData = cache.get('salestable');
  if (cachedData) {
    console.log('Returning cached sales table data.');
    return res.json(cachedData);
  } else {
    console.log('No cached data for sales table.');
    res.status(500).json({ message: 'Error fetching data' });
  }
});

app.get('/api/salesfulfilment', (req, res) => {
  const cachedData = cache.get('salesfulfilment');
  if (cachedData) {
    console.log('Returning cached sales fulfilment data.');
    return res.json(cachedData);
  } else {
    console.log('No cached data for sales fulfilment.');
    res.status(500).json({ message: 'Error fetching data' });
  }
});

app.listen(3001, () => {
  console.log('Server listening on port 3001');
});
