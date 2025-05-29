const express = require('express');
// const http = require('http'); // لم نعد بحاجة إليه إذا استخدمنا axios للكل
const axios = require('axios');
const app = express();
const port = 3000;

// --- NEW: Initialize an in-memory cache ---
const cache = {};
// ------------------------------------------
const CATALOG_SERVICE_URL = 'http://catalog:4000';
const ORDER_SERVICE_URL = 'http://order:5000';

app.get('/search/:topic', (req, res) => {
    const topic = req.params.topic;
    axios.get(`${CATALOG_SERVICE_URL}/search/${topic}`)
        .then(response => {
            console.log('Fetched search results successfully:', response.data); // رسالتك الأصلية
            res.json(response.data);
        })
        .catch(error => {
            console.error(`Error fetching search results for topic '${topic}':`, error.message);
            if (error.response) {
                console.error("Non-JSON response received or catalog error:", error.response.data); // أقرب لرسالتك الأصلية
                res.status(error.response.status).json(error.response.data);
            } else {
                console.error("HTTP error:", error.message); // رسالتك الأصلية
                res.status(500).json({ error: "Internal frontend error" }); // رسالتك الأصلية
            }
        });
});

app.get('/info/:item_number', (req, res) => {
    const itemNumber = parseInt(req.params.item_number);

    if (cache[itemNumber]) {
        console.log(`Cache hit for item ${itemNumber}`);
        // يمكنك الاحتفاظ برسالة السجل الأصلية إذا أردت:
        // console.log('Fetched item info successfully (from cache):', cache[itemNumber]);
        return res.json(cache[itemNumber]);
    } else {
        console.log(`Cache miss for item ${itemNumber}`);
        axios.get(`${CATALOG_SERVICE_URL}/info/${itemNumber}`)
            .then(response => {
                const bookData = response.data;
                console.log('Fetched item info successfully (from catalog):', bookData); // رسالتك الأصلية
                cache[itemNumber] = bookData;
                res.json(bookData);
            })
            .catch(error => {
                console.error(`Error fetching info for item ${itemNumber}:`, error.message);
                if (error.response) {
                    console.error("Non-JSON response received or catalog error:", error.response.data);
                    res.status(error.response.status).json(error.response.data);
                } else {
                    console.error("HTTP error:", error.message);
                    res.status(500).json({ error: "Internal frontend error" });
                }
            });
    }
});

app.post('/purchase/:item_number', async (req, res) => {
    const itemNumber = req.params.item_number;
    try {
        const response = await axios.post(`${ORDER_SERVICE_URL}/purchase/${itemNumber}`);
        console.log('Ordered successfully'); // رسالتك الأصلية
        console.log(response.data); // رسالتك الأصلية

        // --- IMPORTANT FOR CACHE CONSISTENCY (LATER) ---
        // if (cache[parseInt(itemNumber)]) {
        //     delete cache[parseInt(itemNumber)];
        //     console.log(`Cache invalidated for item ${itemNumber} after purchase.`);
        // }
        // -----------------------------------------------
        res.json(response.data);
    } catch (error) {
        console.error("Purchase error:", error.message); // رسالتك الأصلية
        if (error.response) {
            res.status(error.response.status).json(error.response.data);
        } else {
            res.status(500).json({ error: error.message }); // يمكنك تعديل هذه لتكون أكثر تحديدًا
        }
    }
});

app.listen(port, () => {
    console.log(`Front end server is running at http://localhost:${port}`); // رسالتك الأصلية
});