const express = require('express');
const http = require('http');
const axios = require('axios');
const app = express();
const port = 3000;

app.get('/search/:topic', (req, res) => {
    try {
        http.get('http://localhost:4000/search/' + req.params.topic, (response) => {
            let data = '';
            response.on("data", chunk => data += chunk);
            response.on("end", () => {
                const responseData = JSON.parse(data);
                res.json(responseData);
                console.log('Fetched successfully');
                console.log(responseData);
            });
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/info/:item_number', (req, res) => {
    try {
        http.get('http://localhost:4000/info/' + req.params.item_number, (response) => {
            let data = '';
            response.on("data", chunk => data += chunk);
            response.on("end", () => {
                const responseData = JSON.parse(data);
                res.json(responseData);
                console.log('Fetched successfully');
                console.log(responseData);
            });
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/purchase/:item_number', async (req, res) => {
    try {
        const response = await axios.post(`http://localhost:5000/purchase/${req.params.item_number}`);
        console.log('Ordered successfully');
        console.log(response.data);
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
    console.log("Front end server is running at 3000");
});
