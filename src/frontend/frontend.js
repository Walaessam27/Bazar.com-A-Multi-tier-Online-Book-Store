const express = require('express');
const http = require('http');
const axios = require('axios');
const app = express();
const port = 3000;

app.get('/search/:topic', (req, res) => {
    http.get('http://catalog:4000/search/' + req.params.topic, (response) => {
        let data = '';
        response.on("data", chunk => data += chunk);
        response.on("end", () => {
            try {
                const responseData = JSON.parse(data);
                console.log('Fetched search results successfully:', responseData);
                res.json(responseData);
            } catch (error) {
                console.error("Non-JSON response received:", data);
                res.status(response.statusCode || 500).json({ error: data });
            }
        });
    }).on('error', (err) => {
        console.error("HTTP error:", err.message);
        res.status(500).json({ error: "Internal frontend error" });
    });
});

app.get('/info/:item_number', (req, res) => {
    http.get('http://catalog:4000/info/' + req.params.item_number, (response) => {
        let data = '';
        response.on("data", chunk => data += chunk);
        response.on("end", () => {
            try {
                const responseData = JSON.parse(data);
                console.log('Fetched item info successfully:', responseData);
                res.json(responseData);
            } catch (error) {
                console.error("Non-JSON response received:", data);
                res.status(response.statusCode || 500).json({ error: data });
            }
        });
    }).on('error', (err) => {
        console.error("HTTP error:", err.message);
        res.status(500).json({ error: "Internal frontend error" });
    });
});

app.post('/purchase/:item_number', async (req, res) => {
    try {
        const response = await axios.post(`http://order:5000/purchase/${req.params.item_number}`);
        console.log('Ordered successfully');
        console.log(response.data);
        res.json(response.data);
    } catch (error) {
        console.error("Purchase error:", error.message);
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
    console.log("Front end server is running at 3000");
});
