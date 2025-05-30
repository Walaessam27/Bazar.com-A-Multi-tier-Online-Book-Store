// order_server/app.js
const express = require('express');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// --- Database Configuration ---
const databaseFilename = process.env.DATABASE_FILENAME || 'default_order_data.db';
const dbPath = path.join('/app/db', databaseFilename); 
const CURRENT_ORDER_INSTANCE_NAME = process.env.INSTANCE_NAME || 'order_unknown_instance';

console.log(`🧭 Order instance (${CURRENT_ORDER_INSTANCE_NAME}) using database at path: ${dbPath}`);

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
    if (err) {
        console.error(`❌ Failed to open/create DB for ${CURRENT_ORDER_INSTANCE_NAME} at ${dbPath}:`, err.message);
        process.exit(1); 
    }
    console.log(`✅ Connected to SQLite database for ${CURRENT_ORDER_INSTANCE_NAME} at ${dbPath}`);
    initializeOrderDatabase();
});

function initializeOrderDatabase() {
    const createOrderTableSql = `
      CREATE TABLE IF NOT EXISTS "order" (
        order_number INTEGER PRIMARY KEY AUTOINCREMENT,
        item_number TEXT NOT NULL 
      )
    `;
    db.run(createOrderTableSql, (err) => {
        if (err) {
            console.error(`❌ Order table creation failed for ${CURRENT_ORDER_INSTANCE_NAME}:`, err.message);
            
        } else {
            console.log(`📦 Order table checked/created for ${CURRENT_ORDER_INSTANCE_NAME}.`);
        }
    });
}
//End Database Configuration

const app = express();
const port = 5000;
app.use(express.json());

//  Catalog Service Configuration for Order Service 
const CATALOG_REPLICA_URLS_FOR_ORDER_SVC = (process.env.CATALOG_REPLICAS_URLS_FOR_ORDER || "http://catalog1:4000,http://catalog2:4000")
                                            .split(',')
                                            .map(url => url.trim())
                                            .filter(url => url);
let currentCatalogReadReplicaIndex = 0;

async function getNextCatalogReadReplicaUrl() {
    if (CATALOG_REPLICA_URLS_FOR_ORDER_SVC.length === 0) {
        console.error(`[${CURRENT_ORDER_INSTANCE_NAME}] PANIC: No catalog replicas configured for order service to read from!`);
        throw new Error("Catalog service not available for order processing.");
    }
    const url = CATALOG_REPLICA_URLS_FOR_ORDER_SVC[currentCatalogReadReplicaIndex];
    currentCatalogReadReplicaIndex = (currentCatalogReadReplicaIndex + 1) % CATALOG_REPLICA_URLS_FOR_ORDER_SVC.length;
    return url;
}
//  End Catalog Service Configuration 

app.post('/purchase/:item_number', async (req, res) => {
    const itemNoStr = req.params.item_number;
  

    if (!itemNoStr || isNaN(parseInt(itemNoStr, 10))) { // التأكد أنه يمكن تحويله لرقم
        return res.status(400).json({ message: `Invalid item number format: ${itemNoStr}` });
    }

    try {
        let catalogResponse;
        const catalogReadUrl = await getNextCatalogReadReplicaUrl();
        try {
            catalogResponse = await axios.get(`${catalogReadUrl}/info/${itemNoStr}`, { timeout: 3000 });
        } catch (err) {
            console.error(`[${CURRENT_ORDER_INSTANCE_NAME}] ❌ Error fetching item ${itemNoStr} info from ${catalogReadUrl}:`, err.message);
            if (err.response && err.response.status === 404) {
                return res.status(404).json({ message: `Item ${itemNoStr} not found in catalog.` });
            }
            return res.status(503).json({ message: `Catalog service (${catalogReadUrl}) unavailable or error occurred.` });
        }

        const item = catalogResponse.data;
        if (!item || typeof item.Stock === 'undefined') {
            console.error(`[${CURRENT_ORDER_INSTANCE_NAME}] ❌ Invalid data received from catalog for item ${itemNoStr}:`, item);
            return res.status(500).json({ message: 'Invalid data received from catalog.' });
        }

        if (item.Stock > 0) {
            const newStock = item.Stock - 1;
            const updatePayload = { Stock: newStock };
            const catalogUpdateTargets = CATALOG_REPLICA_URLS_FOR_ORDER_SVC; 
            let allCatalogUpdatesSucceeded = true;

            for (const targetCatalogUrl of catalogUpdateTargets) {
                try {
                    // فس الكتالوج (مسار /update) هي المسؤولة عن مزامنتها الداخلية وإلغاء صلاحية الكاش
                    await axios.put(`${targetCatalogUrl}/update/${itemNoStr}`, updatePayload, { timeout: 4000 });
                    console.log(`[${CURRENT_ORDER_INSTANCE_NAME}] ✅ Stock update request sent to ${targetCatalogUrl} for item ${itemNoStr}.`);
                } catch (updateErr) {
                    allCatalogUpdatesSucceeded = false;
                    console.error(`[${CURRENT_ORDER_INSTANCE_NAME}] ❌ Failed to send stock update to ${targetCatalogUrl} for item ${itemNoStr}:`,
                                  updateErr.response ? updateErr.response.data : updateErr.message);
                }
            }

            const insertOrderSql = `INSERT INTO "order" (item_number) VALUES (?)`;
            db.run(insertOrderSql, [itemNoStr], function (err) { 
                if (err) {
                    console.error(`[${CURRENT_ORDER_INSTANCE_NAME}] ❌ Failed to insert order into DB:`, err.message);
                  
                    return res.status(500).json({ message: 'Order recording failed after stock update attempt.' });
                }
                const orderNumber = this.lastID;
                console.log(`[${CURRENT_ORDER_INSTANCE_NAME}] 🛍️ Order for item ${itemNoStr} recorded. Order number: ${orderNumber}`);

  
                
                const responseMessage = allCatalogUpdatesSucceeded ?
                    `Item purchased successfully. Stock update initiated on catalog replicas by ${CURRENT_ORDER_INSTANCE_NAME}.` :
                    `Item purchased by ${CURRENT_ORDER_INSTANCE_NAME}. Stock update initiation on catalog replicas had issues; please verify stock. Catalog will handle cache.`;

                return res.status(200).json({
                    message: responseMessage,
                    order_number: orderNumber,
                    item_number: itemNoStr,
                    catalog_updates_fully_successful: allCatalogUpdatesSucceeded
                });
            });

        } else {
            console.log(`[${CURRENT_ORDER_INSTANCE_NAME}] 🚫 Item ${itemNoStr} is out of stock (Stock: ${item.Stock}).`);
            return res.status(409).json({ message: `Item ${itemNoStr} is currently out of stock.` });
        }

    } catch (generalError) {
        console.error(`[${CURRENT_ORDER_INSTANCE_NAME}] 💣 Unexpected error during purchase of item ${itemNoStr}:`, generalError.message);
        res.status(500).json({ message: 'An unexpected error occurred during purchase.' });
    }
});

app.listen(port, () => {
    console.log(`🛍️ Order service (${CURRENT_ORDER_INSTANCE_NAME}) is live on port ${port}`);
    if (CATALOG_REPLICA_URLS_FOR_ORDER_SVC.length > 0) {
        console.log(`🔗 Order service will read catalog info from: ${CATALOG_REPLICA_URLS_FOR_ORDER_SVC.join(', ')} (Round Robin)`);
    } else {
        console.warn(`⚠️ No catalog replicas configured for order service to read from! This will cause errors.`);
    }
});