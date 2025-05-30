// catalog_server/dbconfig.js

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// --- MODIFIED: Determine database path 
const databaseFilename = process.env.DATABASE_FILENAME || 'default_catalog_data.db';
const dbPath = path.join('/app/db', databaseFilename); // Path inside the container, linked by volume
// 

console.log(`🧭 Catalog instance (${process.env.INSTANCE_NAME || 'unknown'}) using database at path: ${dbPath}`);

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
    if (err) {
        console.error(`❌ Failed to open/create DB for ${process.env.INSTANCE_NAME || 'unknown'} at ${dbPath}:`, err.message);
        // Consider exiting if DB connection fails critically
        process.exit(1); 
    }
    console.log(`✅ Connected to SQLite database for ${process.env.INSTANCE_NAME || 'unknown'} at ${dbPath}`);
    
    initializeDatabase(); 
});

// Function to initialize database 
function initializeDatabase() {
    db.serialize(() => { 
        const createTableSql = `CREATE TABLE IF NOT EXISTS catalog(
                                ISBN INTEGER PRIMARY KEY,
                                Title TEXT,
                                Cost INTEGER, 
                                Topic TEXT,
                                Stock INTEGER
                              )`;
        db.run(createTableSql, (err) => {
            if (err) {
                return console.error(`❌ Error creating catalog table for ${process.env.INSTANCE_NAME || 'unknown'}:`, err.message);
            }
            console.log(`📖 Catalog table checked/created for ${process.env.INSTANCE_NAME || 'unknown'}.`);

          
            db.get("SELECT COUNT(*) as count FROM catalog", (err, row) => {
                if (err) {
                    return console.error(`❌ Error checking catalog table count for ${process.env.INSTANCE_NAME || 'unknown'}:`, err.message);
                }
                if (row && row.count === 0) {
                    console.log(`📚 Populating initial book data for ${process.env.INSTANCE_NAME || 'unknown'}...`);
                    const initialBooks = [
                        { isbn: 1, title: "How to get a good grade in DOS in 40 minutes a day", cost: 25, topic: "distributed systems", stock: 10 },
                        { isbn: 2, title: "RPCs for Noobs", cost: 30, topic: "distributed systems", stock: 5 },
                        { isbn: 3, title: "Xen and the Art of Surviving Undergraduate School", cost: 35, topic: "undergraduate school", stock: 12 },
                        { isbn: 4, title: "Cooking for the Impatient Undergrad", cost: 20, topic: "undergraduate school", stock: 7 },
                        { isbn: 5, title: "How to finish Project 3 on time", cost: 22, topic: "undergraduate school", stock: 8 },
                        { isbn: 6, title: "Why theory classes are so hard.", cost: 18, topic: "undergraduate school", stock: 15 },
                        { isbn: 7, title: "Spring in the Pioneer Valley", cost: 28, topic: "undergraduate school", stock: 20 }
                    ];
                    
                    const insertSql = `INSERT INTO catalog (ISBN, Title, Cost, Topic, Stock) VALUES (?, ?, ?, ?, ?)`;
                    initialBooks.forEach(book => {
                        db.run(insertSql, [book.isbn, book.title, book.cost, book.topic, book.stock], (insertErr) => {
                            if (insertErr) {
                                console.error(`❌ Error inserting book (ISBN: ${book.isbn}) for ${process.env.INSTANCE_NAME || 'unknown'}:`, insertErr.message);
                            }
                        });
                    });
                    console.log(`📚 Finished populating initial book data for ${process.env.INSTANCE_NAME || 'unknown'}.`);
                } else {
                    console.log(`📖 Catalog table for ${process.env.INSTANCE_NAME || 'unknown'} already contains data or error checking count.`);
                }
            });
        });
    });
}

function searchTopic(topic, callback) {
    const sql = `SELECT * FROM catalog where Topic = ? COLLATE NOCASE`;
    db.all(sql, [topic], (err, rows) => {
        if (err) {
            console.error(`❌ SQL Error in searchTopic() for ${process.env.INSTANCE_NAME || 'unknown'}:`, err.message);
            return callback(err, null);
        }
        callback(null, rows);
    });
}

function info(ISBN, callback) {
    const sql = `SELECT * FROM catalog WHERE ISBN = ?`;
    db.get(sql, [ISBN], (err, singleRow) => {
        if (err) {
            console.error(`❌ SQL Error in info() for ${process.env.INSTANCE_NAME || 'unknown'}:`, err.message);
            return callback(err, null);
        }
        callback(null, singleRow);
    });
}

function updateStock(stock, ISBN, callback) {
    const sql = `UPDATE catalog SET Stock = ? WHERE ISBN = ?`;
    db.run(sql, [stock, ISBN], function (err) {
        if (err) {
            console.error(`❌ SQL Error in updateStock() for ${process.env.INSTANCE_NAME || 'unknown'}:`, err.message);
            return callback(err, null);
        }
        callback(null, this.changes);
    });
}

module.exports = {
   
    searchTopic,
    info,
    updateStock,
};