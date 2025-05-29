// order_server/app.js
const express = require('express');
// const http = require('http'); // لم نعد بحاجة إليه
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();

const path = require('path');

const dbPath = path.join(__dirname, 'db', 'dataorder.db');
const db = new sqlite3.Database(dbPath, (err) => { 
    if (err) {
        console.error('Failed to open/create order database:', err.message);
        process.exit(1); // Exit if DB cannot be opened
    }
});

const app = express();
const port = 5000;

const FRONTEND_SERVICE_URL = process.env.FRONTEND_SERVICE_URL || 'http://frontend:3000';

const createOrderTable = `
  CREATE TABLE IF NOT EXISTS "order" (
    order_number INTEGER PRIMARY KEY AUTOINCREMENT, -- Added AUTOINCREMENT for clarity
    item_number TEXT NOT NULL -- It's good practice to specify data types and NOT NULL if applicable
  )
`;

db.serialize(() => { 
    db.run(createOrderTable, (err) => {
        if (err) {
            console.error('Order table creation failed:', err.message);
            process.exit(1); 
        } else {
            console.log('Order table ready.');
        }
    });
});


app.post('/purchase/:item_number', async (req, res) => {
    const itemNoStr = req.params.item_number; 
    const itemNo = parseInt(itemNoStr, 10); // For cache invalidation 

    if (isNaN(itemNo)) {
        return res.status(400).json({ message: `Invalid item number format: ${itemNoStr}` });
    }

    const catalogInfoUrl = `http://catalog:4000/info/${itemNoStr}`; 
    const catalogUpdateUrl = `http://catalog:4000/update/${itemNoStr}`;

    try {
        // 1. التحقق من معلومات المنتج والمخزون من الكتالوج أولاً
        let catalogResponse;
        try {
            catalogResponse = await axios.get(catalogInfoUrl);
        } catch (err) {
            console.error(`Error fetching item ${itemNoStr} info from catalog:`, err.message);
            if (err.response && err.response.status === 404) {
                return res.status(404).json({ message: `Item ${itemNoStr} not found in catalog.` });
            }
            return res.status(503).json({ message: 'Catalog service unavailable or error occurred.' });
        }

        const item = catalogResponse.data;

        if (!item || typeof item.Stock === 'undefined') {
            console.error(`Invalid data received from catalog for item ${itemNoStr}:`, item);
            return res.status(500).json({ message: 'Invalid data received from catalog.' });
        }

        // 2. التحقق مما إذا كان المنتج متوفرًا
        if (item.Stock > 0) {
            const newStock = item.Stock - 1;
            const payload = { Stock: newStock };

            // 3. تحديث المخزون في الكتالوج
            try {
                await axios.put(catalogUpdateUrl, payload);
                console.log(`Stock updated for item ${itemNoStr} to ${newStock}.`);
            } catch (updateErr) {
                console.error(`Stock update failed for item ${itemNoStr} in catalog:`, updateErr.message);
                return res.status(500).json({ message: 'Failed to update stock in catalog.' });
            }

            const insertOrder = `INSERT INTO "order" (item_number) VALUES (?)`;
            db.run(insertOrder, [itemNoStr], function (err) { // itemNoStr or itemNo, be consistent with table schema
                if (err) {
                    console.error('Failed to insert order into database:', err.message);
                    return res.status(500).json({ message: 'Order recording failed after stock update.' });
                }
                const orderNumber = this.lastID;
                console.log(`Order for item ${itemNoStr} recorded. Order number: ${orderNumber}`);

                axios.post(`${FRONTEND_SERVICE_URL}/cache/invalidate/${itemNo}`)
                    .then(invalidationResponse => {
                        console.log(`Cache invalidation request for item ${itemNo} sent: ${invalidationResponse.data.message}`);
                    })
                    .catch(invalidationError => {
           
                        console.error(`Error sending cache invalidation for item ${itemNo}:`, 
                                      invalidationError.response ? invalidationError.response.data : invalidationError.message);
                    });

                return res.status(200).json({
                    message: 'Item purchased successfully.',
                    order_number: orderNumber,
                    item_number: itemNoStr, 
                    new_stock: newStock    
                });
            });

        } else {
            console.log(`Item ${itemNoStr} is out of stock (Stock: ${item.Stock}).`);
            return res.status(409).json({ message: `Item ${itemNoStr} is currently out of stock.` });
        }

    } catch (generalError) {
        console.error(`Unexpected error during purchase of item ${itemNoStr}:`, generalError.message);
        res.status(500).json({ message: 'An unexpected error occurred during purchase.' });
    }
});


app.listen(port, () => {
    console.log(`Order service is live on port ${port}`);
});