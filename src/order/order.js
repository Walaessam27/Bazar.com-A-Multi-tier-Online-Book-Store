// order_server/app.js (الكود الكامل المعدل)
const express = require('express');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// --- MODIFIED: Determine database path based on environment variable ---
const databaseFilename = process.env.DATABASE_FILENAME || 'default_order_data.db'; // Fallback
const dbPath = path.join('/app/db', databaseFilename); // Path inside container, linked by volume
// --------------------------------------------------------------------

console.log(`🧭 Order instance (${process.env.INSTANCE_NAME || 'unknown'}) using database at path: ${dbPath}`);

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
    if (err) {
        console.error(`❌ Failed to open/create DB for ${process.env.INSTANCE_NAME || 'unknown'} at ${dbPath}:`, err.message);
        process.exit(1);
    }
    console.log(`✅ Connected to SQLite database for ${process.env.INSTANCE_NAME || 'unknown'} at ${dbPath}`);
    initializeOrderDatabase(); // Call table creation
});

const app = express();
const port = 5000;

const FRONTEND_SERVICE_URL = process.env.FRONTEND_SERVICE_URL || 'http://frontend:3000';

// --- NEW: Function to initialize order database (create table) ---
function initializeOrderDatabase() {
    const createOrderTableSql = `
      CREATE TABLE IF NOT EXISTS "order" (
        order_number INTEGER PRIMARY KEY AUTOINCREMENT,
        item_number TEXT NOT NULL 
      )
    `;
    db.run(createOrderTableSql, (err) => {
        if (err) {
            console.error(`❌ Order table creation failed for ${process.env.INSTANCE_NAME || 'unknown'}:`, err.message);
            // Consider exiting if table creation fails critically
            // process.exit(1); 
        } else {
            console.log(`📦 Order table checked/created for ${process.env.INSTANCE_NAME || 'unknown'}.`);
        }
    });
}
// ---------------------------------------------------------------

// Middleware to parse JSON bodies (if you ever need to send JSON to order server)
app.use(express.json());

app.post('/purchase/:item_number', async (req, res) => {
    const itemNoStr = req.params.item_number;
    const itemNo = parseInt(itemNoStr, 10);

    if (isNaN(itemNo)) {
        return res.status(400).json({ message: `Invalid item number format: ${itemNoStr}` });
    }

    const catalogInfoUrl = `http://catalog1:4000/info/${itemNoStr}`; // Default to catalog1 for info
    // In a more robust load balancing, this URL would be chosen by a load balancer
    // For now, let's assume order service primarily interacts with one catalog instance for reads
    // or that catalog service name `catalog` (if defined as single service with replicas in compose) handles LB
    // Since we defined catalog1 and catalog2, we need to be explicit or implement LB here too if needed.
    // For simplicity, order service will query catalog1. Updates will need to be smarter later for sync.

    const catalogUpdateUrlBase = `http://catalog<REPLICA_NUM>:4000/update/${itemNoStr}`; // Placeholder for now

    try {
        let catalogResponse;
        try {
            // For purchase, we might need to decide which catalog replica to query stock from.
            // Let's query catalog1 for now.
            // Later, frontend will use load balancing. Order server itself might also need a strategy
            // if it directly queries multiple catalog replicas.
            const activeCatalogUrlForRead = (await getActiveCatalogReplica()).url; // Simple round robin for read
            catalogResponse = await axios.get(activeCatalogUrlForRead + `/info/${itemNoStr}`);

        } catch (err) {
            console.error(`❌ Error fetching item ${itemNoStr} info from catalog by ${process.env.INSTANCE_NAME || 'unknown'}:`, err.message);
            if (err.response && err.response.status === 404) {
                return res.status(404).json({ message: `Item ${itemNoStr} not found in catalog.` });
            }
            return res.status(503).json({ message: 'Catalog service unavailable or error occurred.' });
        }

        const item = catalogResponse.data;

        if (!item || typeof item.Stock === 'undefined') {
            console.error(`❌ Invalid data received from catalog for item ${itemNoStr} by ${process.env.INSTANCE_NAME || 'unknown'}:`, item);
            return res.status(500).json({ message: 'Invalid data received from catalog.' });
        }

        if (item.Stock > 0) {
            const newStock = item.Stock - 1;
            const payload = { Stock: newStock };

            // --- IMPORTANT: Updating Catalog Replicas ---
            // When an order is placed, the stock needs to be decremented on *ALL* catalog replicas
            // This is part of the data synchronization requirement.
            // For now, we will attempt to update both. A more robust system would use a 2-phase commit or similar.
            const catalogReplicaUrls = ["http://catalog1:4000", "http://catalog2:4000"]; // From compose or config
            let allUpdatesSucceeded = true;

            for (const catalogUrl of catalogReplicaUrls) {
                try {
                    await axios.put(`${catalogUrl}/update/${itemNoStr}`, payload);
                    console.log(`✅ Stock updated on ${catalogUrl} for item ${itemNoStr} to ${newStock} by ${process.env.INSTANCE_NAME || 'unknown'}.`);
                } catch (updateErr) {
                    allUpdatesSucceeded = false;
                    console.error(`❌ Stock update failed on ${catalogUrl} for item ${itemNoStr} by ${process.env.INSTANCE_NAME || 'unknown'}:`, updateErr.message);
                    // If one update fails, we have an inconsistency.
                    // How to handle? Rollback? Log and alert?
                    // For this lab, we'll proceed but log the error. In a real system, this needs robust handling.
                }
            }

            if (!allUpdatesSucceeded) {
                // If any catalog update failed, we might not want to confirm the order,
                // or we mark it as potentially inconsistent.
                // For now, we'll return an error to indicate partial failure.
                // This is a simplification. True distributed transactions are complex.
                console.warn(`⚠️ Purchase of item ${itemNoStr} by ${process.env.INSTANCE_NAME || 'unknown'} completed, but catalog stock updates were not all successful. Potential inconsistency.`);
                // Optionally, you could still record the order but flag it.
                // Or, if strict consistency is required, fail the purchase here.
                // Let's fail it for now to highlight the issue of distributed updates.
                // return res.status(500).json({ message: 'Failed to update stock consistently across all catalog replicas.' });
                // OR, let's proceed with order recording but acknowledge the potential issue
            }
            // --- End of Catalog Replicas Update ---


            const insertOrder = `INSERT INTO "order" (item_number) VALUES (?)`;
            db.run(insertOrder, [itemNoStr], function (err) {
                if (err) {
                    console.error(`❌ Failed to insert order into DB for ${process.env.INSTANCE_NAME || 'unknown'}:`, err.message);
                    return res.status(500).json({ message: 'Order recording failed after stock update.' });
                }
                const orderNumber = this.lastID;
                console.log(`🛍️ Order for item ${itemNoStr} by ${process.env.INSTANCE_NAME || 'unknown'} recorded. Order number: ${orderNumber}`);

                axios.post(`${FRONTEND_SERVICE_URL}/cache/invalidate/${itemNo}`)
                    .then(invalidationResponse => {
                        console.log(`➡️ Cache invalidation for item ${itemNo} by ${process.env.INSTANCE_NAME || 'unknown'} sent: ${invalidationResponse.data.message}`);
                    })
                    .catch(invalidationError => {
                        console.error(`⚠️ Error sending cache invalidation for item ${itemNo} by ${process.env.INSTANCE_NAME || 'unknown'}:`,
                            invalidationError.response ? invalidationError.response.data : invalidationError.message);
                    });
                
                const responseMessage = allUpdatesSucceeded ? 
                    'Item purchased successfully and stock updated.' :
                    'Item purchased, but stock update on all catalog replicas had issues. Please verify stock.';

                return res.status(200).json({
                    message: responseMessage,
                    order_number: orderNumber,
                    item_number: itemNoStr,
                    new_stock: newStock, // This is the new stock on the queried replica before sync
                    stock_update_consistent: allUpdatesSucceeded
                });
            });

        } else {
            console.log(`🚫 Item ${itemNoStr} is out of stock (Stock: ${item.Stock}) for ${process.env.INSTANCE_NAME || 'unknown'}.`);
            return res.status(409).json({ message: `Item ${itemNoStr} is currently out of stock.` });
        }

    } catch (generalError) {
        console.error(`💣 Unexpected error during purchase of item ${itemNoStr} by ${process.env.INSTANCE_NAME || 'unknown'}:`, generalError.message);
        res.status(500).json({ message: 'An unexpected error occurred during purchase.' });
    }
});

// --- Helper for simple round-robin for catalog reads by order service ---
// This is a very basic illustration. Frontend will have a more structured one.
let currentCatalogReplicaIndex = 0;
const CATALOG_REPLICA_URLS_FOR_ORDER_SVC = ["http://catalog1:4000", "http://catalog2:4000"];

async function getActiveCatalogReplica() {
    // In a real scenario, you'd check health. For now, just round-robin.
    const url = CATALOG_REPLICA_URLS_FOR_ORDER_SVC[currentCatalogReplicaIndex];
    currentCatalogReplicaIndex = (currentCatalogReplicaIndex + 1) % CATALOG_REPLICA_URLS_FOR_ORDER_SVC.length;
    // console.log(`Order service using catalog replica: ${url}`); // for debugging
    return { url: url };
}
// --- End helper ---


app.listen(port, () => {
    console.log(`🛍️ Order service (${process.env.INSTANCE_NAME || 'unknown'}) is live on port ${port}`);
});