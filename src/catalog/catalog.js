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
});



// Start server
app.listen(port, () => {
    console.log(`Catalog server running on port ${port}`);
});
