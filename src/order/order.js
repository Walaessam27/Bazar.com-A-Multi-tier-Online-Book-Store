const express = require('express');
const http = require('http');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();

const path = require('path');

const dbPath = path.join(__dirname, 'dataorder.db'); // Always create DB in current file's directory
const db = new sqlite3.Database(dbPath);
const app = express();
const port = 5000;

// Create "order" table if it doesn't exist
const createOrderTable = `
  CREATE TABLE IF NOT EXISTS "order" (
    order_number INTEGER PRIMARY KEY,
    item_number
  )
`;

db.run(createOrderTable, (err) => {
    if (err) {
        console.error('Table creation failed:', err.message);
    } else {
        console.log('Order table ready.');
    }
});

// Handle item purchase
app.post('/purchase/:item_number', (req, res) => {
    const itemNo = req.params.item_number;

    // Insert order into the database
    const insertOrder = `INSERT INTO "order" (item_number) VALUES (?)`;
    db.run(insertOrder, [itemNo], (err) => {
        if (err) {
            console.error('Failed to insert order:', err.message);
        } else {
            console.log(`Order for item ${itemNo} recorded.`);
        }
    });

    // Display all orders
    const getAllOrders = `SELECT * FROM "order"`;
    db.all(getAllOrders, [], (err, rows) => {
        if (err) {
            console.error('Error fetching orders:', err.message);
        } else {
            console.log('Current orders in table:');
            rows.forEach((row) => console.log(row));
        }
    });

    // Fetch item details from catalog server
    http.get(`http://catalog:4000/info/${itemNo}`, (catalogRes) => {
        let data = '';

        catalogRes.on('data', (chunk) => {
            data += chunk;
        });

        catalogRes.on('end', () => {
            try {
                const item = JSON.parse(data)[0];

                if (item.Stock > 0) {
                    const newStock = item.Stock - 1;
                    const payload = { Stock: newStock };

                    axios.put(`http://catalog:4000/update/${itemNo}`, payload)
                        .then(() => {
                            console.log(`Stock updated for item ${itemNo}.`);
                            res.json({ message: 'Item purchased successfully.' });
                        })
                        .catch((err) => {
                            console.error('Stock update failed:', err.message);
                            res.status(500).json({ message: 'Stock update failed.' });
                        });

                } else {
                    console.log(`Item ${itemNo} is out of stock.`);
                    res.json({ message: 'Item currently unavailable.' });
                }
            } catch (parseErr) {
                console.error('Failed to parse catalog response:', parseErr.message);
                res.status(500).json({ message: 'Invalid data from catalog.' });
            }
        });
    }).on('error', (err) => {
        console.error('Catalog service unreachable:', err.message);
        res.status(500).json({ message: 'Failed to fetch item details.' });
    });
});

// Start the order server
app.listen(port, () => {
    console.log(`Order service is live on port ${port}`);
});