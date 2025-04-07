const express = require('express');
const http = require('http');
const DatabaseConfig = require('./dbconfig');

const app = express();
const port = 4000;

app.use(express.json());

// Search items by topic
app.get('/search/:topic', (req, res) => {
    DatabaseConfig.searchTopic(req.params.topic, (err, data) => {
        if (err) {
            res.status(500).send('Unable to fetch data. Database error occurred');
        } else {
            console.log(`Fetched data for topic: ${req.params.topic}`);
            res.json(data);
        }
    });
});// Get item info by item number
app.get('/info/:item_number', (req, res) => {
    DatabaseConfig.info(req.params.item_number, (err, data) => {
        if (err) {
            res.status(500).send('Unable to retrieve item information. Database error occurred');
        } else {
            console.log(`Fetched info for item: ${req.params.item_number}`);
            res.json(data);
        }
    });
});

// Update stock for an item
app.put('/update/:item_number', (req, res) => {
    const stock = req.body.Stock;
    DatabaseConfig.updateStock(stock, req.params.item_number, (err) => {
        if (err) {
            res.status(500).send('Failed to update stock. Database error occurred');
        } else {
            res.status(200).send(`Stock for item ${req.params.item_number} updated`);
        }
    });
});




// Start server
app.listen(port, () => {
    console.log(`Catalog server running on port ${port}`);
});