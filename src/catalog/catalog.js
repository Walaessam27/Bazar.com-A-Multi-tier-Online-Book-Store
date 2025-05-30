// catalog_server/app.js
const express = require('express');
const axios = require('axios');
const DatabaseConfig = require('./dbconfig'); 

const app = express();
const port = 4000;

app.use(express.json());

// --- Configuration for inter-service communication ---
const FRONTEND_SERVICE_URL = process.env.FRONTEND_SERVICE_URL || 'http://frontend:3000';
// OTHER_CATALOG_REPLICAS_URLS سيكون سلسلة مفصولة بفاصلة من متغير البيئة
const otherCatalogReplicasRaw = process.env.OTHER_CATALOG_REPLICAS_URLS || "";
const OTHER_CATALOG_REPLICAS = otherCatalogReplicasRaw
                                .split(',')
                                .map(url => url.trim())
                                .filter(url => url); // لإزالة أي سلاسل فارغة

const CURRENT_INSTANCE_NAME = process.env.INSTANCE_NAME || 'catalog_unknown_instance';
// ----------------------------------------------------

// Search items by topic
app.get('/search/:topic', (req, res) => {
    const topic = req.params.topic;
    DatabaseConfig.searchTopic(topic, (err, data) => {
        if (err) {
            console.error(`[${CURRENT_INSTANCE_NAME}] Database error fetching topic ${topic}:`, err.message);
            return res.status(500).json({ error: 'Unable to fetch data. Database error occurred' });
        }
        console.log(`[${CURRENT_INSTANCE_NAME}] Fetched data for topic: ${topic}`);
        res.json(data);
    });
});

// Get item info by item number
app.get('/info/:item_number', (req, res) => {
    const itemNumber = parseInt(req.params.item_number, 10);
    if (isNaN(itemNumber)) {
        return res.status(400).json({ error: 'Invalid item number format. Must be an integer.' });
    }

    DatabaseConfig.info(itemNumber, (err, bookData) => {
        if (err) {
            console.error(`[${CURRENT_INSTANCE_NAME}] Database error fetching info for item ${itemNumber}:`, err.message);
            return res.status(500).json({ error: 'Unable to retrieve item information. Database error occurred' });
        }
        if (bookData) {
            console.log(`[${CURRENT_INSTANCE_NAME}] Fetched info for item: ${itemNumber}`);
            res.json(bookData);
        } else {
            console.log(`[${CURRENT_INSTANCE_NAME}] Book with ISBN ${itemNumber} not found.`);
            res.status(404).json({ message: `Book with ISBN ${itemNumber} not found.` });
        }
    });
});

// Update stock (or other properties) for an item
app.put('/update/:item_number', async (req, res) => {
    const itemNumber = parseInt(req.params.item_number, 10);
    if (isNaN(itemNumber)) {
        return res.status(400).json({ error: 'Invalid item number format. Must be an integer.' });
    }

    const stockValue = req.body.Stock;
    if (typeof stockValue === 'undefined' || stockValue === null) {
        return res.status(400).json({ error: 'Stock value is missing in the request body.' });
    }

    const newStock = parseInt(stockValue, 10);
    if (isNaN(newStock) || newStock < 0) {
        return res.status(400).json({ error: 'Stock value must be a non-negative integer.' });
    }

    const isSyncRequest = req.headers['x-sync-request'] === 'true';

    DatabaseConfig.updateStock(newStock, itemNumber, async (err, changes) => {
        if (err) {
            console.error(`[${CURRENT_INSTANCE_NAME}] Failed to update stock locally for item ${itemNumber}:`, err.message);
            return res.status(500).json({ error: 'Failed to update stock. Database error occurred.' });
        }

        if (changes > 0) {
            console.log(`[${CURRENT_INSTANCE_NAME}] Local stock for item ${itemNumber} updated to ${newStock}.`);
            
            let allReplicasSyncedSuccessfully = true;

            if (!isSyncRequest && OTHER_CATALOG_REPLICAS.length > 0) {
                console.log(`[${CURRENT_INSTANCE_NAME}] Attempting to sync other catalog replicas for item ${itemNumber}...`);
                const syncPayload = { Stock: newStock };
                
                for (const replicaUrl of OTHER_CATALOG_REPLICAS) {
                    try {
                        await axios.put(`${replicaUrl}/update/${itemNumber}`, syncPayload, {
                            headers: { 'x-sync-request': 'true' },
                            timeout: 3000 
                        });
                        console.log(`[${CURRENT_INSTANCE_NAME}] Successfully synced item ${itemNumber} with replica ${replicaUrl}`);
                    } catch (syncError) {
                        allReplicasSyncedSuccessfully = false;
                        console.error(`[${CURRENT_INSTANCE_NAME}] Failed to sync item ${itemNumber} with replica ${replicaUrl}:`,
                                      syncError.response ? syncError.response.data : syncError.message);
                    }
                }
            }

            if (!isSyncRequest) { // إلغاء صلاحية الكاش فقط إذا كان هذا هو الطلب الأصلي (وليس طلب مزامنة)
                console.log(`[${CURRENT_INSTANCE_NAME}] Attempting to invalidate cache for item ${itemNumber} in frontend...`);
                try {
                    await axios.post(`${FRONTEND_SERVICE_URL}/cache/invalidate/${itemNumber}`, {}, { timeout: 3000 });
                    console.log(`[${CURRENT_INSTANCE_NAME}] Cache invalidation request for item ${itemNumber} sent successfully to frontend.`);
                } catch (invalidationError) {
                    console.error(`[${CURRENT_INSTANCE_NAME}] Failed to send cache invalidation request for item ${itemNumber} to frontend:`,
                                  invalidationError.response ? invalidationError.response.data : invalidationError.message);
                }
            }
            
            const responseMessage = allReplicasSyncedSuccessfully ?
                `Stock for item ${itemNumber} updated by ${CURRENT_INSTANCE_NAME}. Sync with other replicas successful. Cache invalidation attempted.` :
                `Stock for item ${itemNumber} updated locally by ${CURRENT_INSTANCE_NAME}. Sync with some/all other replicas failed. Cache invalidation attempted.`;

            res.status(200).json({
                message: responseMessage,
                item_number: itemNumber,
                new_stock: newStock,
                all_replicas_synced: allReplicasSyncedSuccessfully 
            });
        } else {
            console.log(`[${CURRENT_INSTANCE_NAME}] Item ${itemNumber} not found for stock update, or stock value is already ${newStock}.`);
            res.status(404).json({ message: `Item ${itemNumber} not found or no change required.` });
        }
    });
});

// Start server
app.listen(port, () => {
    console.log(`🚀 Catalog server (${CURRENT_INSTANCE_NAME}) running on port ${port}`);
    console.log(`🔗 Frontend URL for cache invalidation: ${FRONTEND_SERVICE_URL}`);
    if (OTHER_CATALOG_REPLICAS.length > 0) {
        console.log(`🔗 Other Catalog Replicas for sync: ${OTHER_CATALOG_REPLICAS.join(', ')}`);
    } else {
        console.log("ℹ️ No other catalog replicas configured for sync (or this is the only replica).");
    }
});