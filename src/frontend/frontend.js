// frontend_server/app.js
const express = require('express');
const axios = require('axios');
const app = express();
const port = 3000; // Port the frontend listens on

// --- Cache Initialization ---
const cache = {};
// const FRONTEND_SELF_URL_INTERNAL = 'http://frontend:3000'; // Not used in this file directly

const catalogReplicaUrlsString = process.env.CATALOG_REPLICAS_URLS || "http://catalog1:4000,http://catalog2:4000"; // Fallback
const orderReplicaUrlsString = process.env.ORDER_REPLICAS_URLS || "http://order1:5000,http://order2:5000";     // Fallback

const CATALOG_REPLICAS = catalogReplicaUrlsString.split(',').map(url => url.trim()).filter(url => url);
const ORDER_REPLICAS = orderReplicaUrlsString.split(',').map(url => url.trim()).filter(url => url);

if (CATALOG_REPLICAS.length === 0) {
    console.error("❌ FATAL: No Catalog Service replicas configured. Exiting.");
    process.exit(1);
}
if (ORDER_REPLICAS.length === 0) {
    console.error("❌ FATAL: No Order Service replicas configured. Exiting.");
    process.exit(1);
}

console.log("📚 Catalog Replicas:", CATALOG_REPLICAS);
console.log("🛍️ Order Replicas:", ORDER_REPLICAS);

let currentCatalogIndex = 0;
let currentOrderIndex = 0;

// Helper function to get the next catalog replica URL (Round Robin)
function getNextCatalogUrl() {
    const url = CATALOG_REPLICAS[currentCatalogIndex];
    currentCatalogIndex = (currentCatalogIndex + 1) % CATALOG_REPLICAS.length;
    // console.log(`Selected Catalog URL: ${url}`); // For debugging
    return url;
}

// Helper function to get the next order replica URL (Round Robin)
function getNextOrderUrl() {
    const url = ORDER_REPLICAS[currentOrderIndex];
    currentOrderIndex = (currentOrderIndex + 1) % ORDER_REPLICAS.length;
    // console.log(`Selected Order URL: ${url}`); // For debugging
    return url;
}
// --- End Load Balancer Configuration ---

app.use(express.json()); // If frontend ever needs to parse JSON request bodies

app.get('/search/:topic', (req, res) => {
    const topic = req.params.topic;
    const targetCatalogUrl = getNextCatalogUrl(); // Get URL using Round Robin

    console.log(`🔄 Forwarding search request for topic '${topic}' to ${targetCatalogUrl}`);
    axios.get(`${targetCatalogUrl}/search/${topic}`)
        .then(response => {
            console.log(`✅ Search results for topic '${topic}' fetched successfully from ${targetCatalogUrl}:`, response.data);
            res.json(response.data);
        })
        .catch(error => {
            console.error(`❌ Error fetching search results for topic '${topic}' from ${targetCatalogUrl}:`, error.message);
            if (error.response) {
                res.status(error.response.status).json(error.response.data);
            } else {
                res.status(500).json({ error: "Internal frontend error during search" });
            }
        });
});

app.get('/info/:item_number', (req, res) => {
    const itemNumber = parseInt(req.params.item_number, 10);
    if (isNaN(itemNumber)) {
        return res.status(400).json({ error: "Invalid item number format." });
    }

    if (cache[itemNumber]) {
        console.log(`✅ Cache hit for item ${itemNumber}`);
        return res.json(cache[itemNumber]);
    } else {
        console.log(`⬇️ Cache miss for item ${itemNumber}`);
        const targetCatalogUrl = getNextCatalogUrl(); // Get URL using Round Robin

        console.log(`🔄 Forwarding info request for item ${itemNumber} to ${targetCatalogUrl}`);
        axios.get(`${targetCatalogUrl}/info/${itemNumber}`)
            .then(response => {
                const bookData = response.data;
                console.log(`✅ Item info for item ${itemNumber} fetched successfully from ${targetCatalogUrl}:`, bookData);
                cache[itemNumber] = bookData; // Store in cache
                res.json(bookData);
            })
            .catch(error => {
                console.error(`❌ Error fetching info for item ${itemNumber} from ${targetCatalogUrl}:`, error.message);
                if (error.response) {
                    // If the catalog replica returned an error (e.g., 404 Not Found)
                    res.status(error.response.status).json(error.response.data);
                } else {
                    // Generic error (e.g., catalog replica down)
                    res.status(503).json({ error: `Error connecting to catalog service at ${targetCatalogUrl}` });
                }
            });
    }
});

app.post('/purchase/:item_number', async (req, res) => {
    const itemNumberStr = req.params.item_number;
    // const itemNumberInt = parseInt(itemNumberStr, 10); // Not strictly needed for purchase req if order service handles it

    const targetOrderUrl = getNextOrderUrl(); // Get URL using Round Robin

    console.log(`🔄 Forwarding purchase request for item ${itemNumberStr} to ${targetOrderUrl}`);
    try {
        const response = await axios.post(`${targetOrderUrl}/purchase/${itemNumberStr}`);
        console.log(`✅ Purchase request for item ${itemNumberStr} successful from ${targetOrderUrl}:`, response.data);
        // Cache invalidation is handled by the order service sending a request back to /cache/invalidate
        res.json(response.data);
    } catch (error) {
        console.error(`❌ Error during purchase for item ${itemNumberStr} from ${targetOrderUrl}:`, error.message);
        if (error.response) {
            res.status(error.response.status).json(error.response.data);
        } else {
            res.status(503).json({ error: `Error connecting to order service at ${targetOrderUrl}` });
        }
    }
});


app.post('/cache/invalidate/:item_number', (req, res) => {
    const itemNumberToInvalidate = parseInt(req.params.item_number, 10);

    if (isNaN(itemNumberToInvalidate)) {
        return res.status(400).json({ error: 'Invalid item number format for cache invalidation.' });
    }

    if (cache[itemNumberToInvalidate]) {
        delete cache[itemNumberToInvalidate];
        console.log(`🗑️ Cache invalidated for item ${itemNumberToInvalidate} by external request.`);
        return res.status(200).json({ message: `Cache for item ${itemNumberToInvalidate} invalidated successfully.` });
    } else {
        console.log(`🤷 Item ${itemNumberToInvalidate} not found in cache for invalidation (no action taken).`);
        return res.status(200).json({ message: `Item ${itemNumberToInvalidate} was not in cache.` });
    }
});


app.listen(port, () => {
    console.log(`🚀 Front end server is running at http://localhost:${port}`);
    console.log("🔗 Using Catalog Replicas:", CATALOG_REPLICAS);
    console.log("🔗 Using Order Replicas:", ORDER_REPLICAS);
});