// Import required modules
const express = require('express');                                               // 1) Import express module for building servers
const http = require('http');                                                     // 2) Import http module for handling HTTP requests
const DatabaseConfig = require('./dbconfig');                                    // 3) Import database config to interact with the database
const app = express();                                                           // Create express app
const port = 4000;                                                               // Port for the front-end server is 4000
app.use(express.json());                                                         // Middleware to parse incoming JSON data

// Handle search request for a specific topic
app.get('/search/:topic', (req, res) => {                                          // Get search request
    DatabaseConfig.searchTopic(req.params.topic, (err, data) => {                 // Call the search method from database config
        if (err) {
            res.status(500).send('Unable to fetch data. Database error occurred'); // More descriptive error handling
        } else {
            res.json(data);
            console.log(`Successfully fetched data for topic: ${req.params.topic}`); // More detailed log message
            console.log(data);
        }
    });
});

// Handle request for detailed info on an item
app.get('/info/:item_number', (req, res) => {                                       // Get info for a specific item
    DatabaseConfig.info(req.params.item_number, (err, data) => {                   // Call the info method from database config
        if (err) {
            res.status(500).send('Unable to retrieve item information. Database error occurred'); // More descriptive error handling
        } else {
            console.log(`Successfully fetched details for item number: ${req.params.item_number}`);
            console.log(data);
            res.json(data);                                                       // If success, send the data as JSON
        }
    });
});

// Update stock information for an item
app.put('/update/:item_number', (req, res) => {                                    // Update the stock of an item
    const stock = req.body.Stock;                                                  // Extract the stock from the body
    console.log(`Updating stock for item number: ${req.params.item_number} to ${stock}`);
    DatabaseConfig.updateStock(stock, req.params.item_number, (err) => {           // Call the updateStock method from database config
        if (err) {
            res.status(500).send('Failed to update stock. Database error occurred'); // More descriptive error handling
        } else {
            res.status(200).send(`Stock for item ${req.params.item_number} successfully updated`); // Success message
        }
    });
});

// Start the server
app.listen(port, () => {
    console.log(`Catalog server is up and running on port ${port}`);               // Start the catalog server and specify port
});
