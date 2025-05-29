// catalog_server/app.js
const express = require('express');
const DatabaseConfig = require('./dbconfig'); // Make sure path is correct

const app = express();
const port = 4000;

app.use(express.json()); // Middleware to parse JSON bodies


// Search items by topic
app.get('/search/:topic', (req, res) => {
    const topic = req.params.topic;
    DatabaseConfig.searchTopic(topic, (err, data) => {
        if (err) {
            console.error(`Database error fetching topic ${topic}:`, err.message);
            return res.status(500).json({ error: 'Unable to fetch data. Database error occurred' });
        }
        console.log(`Fetched data for topic: ${topic}`);
        res.json(data);
    });
});

app.get('/info/:item_number', (req, res) => {
    const itemNumber = parseInt(req.params.item_number, 10); // Added radix 10
    if (isNaN(itemNumber)) {
        return res.status(400).json({ error: 'Invalid item number format. Must be an integer.' });
    }

    DatabaseConfig.info(itemNumber, (err, bookData) => {
        if (err) {
            console.error(`Database error fetching info for item ${itemNumber}:`, err.message);
            return res.status(500).json({ error: 'Unable to retrieve item information. Database error occurred' });
        }
        if (bookData) {
            console.log(`Fetched info for item: ${itemNumber}`);
            res.json(bookData);
        } else {
            console.log(`Book with ISBN ${itemNumber} not found.`);
            res.status(404).json({ message: `Book with ISBN ${itemNumber} not found.` });
        }
    });
});

app.put('/update/:item_number', (req, res) => {
    const itemNumber = parseInt(req.params.item_number, 10); // Added radix 10
    if (isNaN(itemNumber)) {
        return res.status(400).json({ error: 'Invalid item number format. Must be an integer.' });
    }

    const stockValue = req.body.Stock;
    if (typeof stockValue === 'undefined' || stockValue === null) {
        return res.status(400).json({ error: 'Stock value is missing in the request body.' });
    }

    const stock = parseInt(stockValue, 10); // Added radix 10
    if (isNaN(stock) || stock < 0) { // Stock cannot be negative
        return res.status(400).json({ error: 'Stock value must be a non-negative integer.' });
    }

    DatabaseConfig.updateStock(stock, itemNumber, (err, changes) => {
        if (err) {
            console.error(`Failed to update stock for item ${itemNumber}:`, err.message);
            return res.status(500).json({ error: 'Failed to update stock. Database error occurred.' });
        }
        if (changes > 0) {
            console.log(`Stock for item ${itemNumber} updated to ${stock}.`);
            // It's good practice to return the updated resource or at least a confirmation
            res.status(200).json({ 
                message: `Stock for item ${itemNumber} updated successfully.`,
                item_number: itemNumber,
                new_stock: stock 
            });
        } else {
  
            console.log(`Item ${itemNumber} not found for stock update, or stock value is already ${stock}.`);
            res.status(404).json({ message: `Item ${itemNumber} not found or no change required.` });
        }
    });
});

// Start server
app.listen(port, () => {
    console.log(`Catalog server running on port ${port}`);
});