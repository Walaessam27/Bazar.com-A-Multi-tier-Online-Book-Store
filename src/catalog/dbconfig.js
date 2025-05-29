// catalog_server/dbconfig.js

// import Sqlite3 module
const sqlite3 = require('sqlite3').verbose();
// create a new Sqlite instance with read-write mode

const path = require('path');
const dbPath = path.join(__dirname, 'db', 'data.db'); // new subdirectory
console.log("🧭 Using database at path:", dbPath);

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
    if (err) {
        return console.error("❌ Failed to open DB:", err.message);
    }
    console.log("✅ Connected to the SQLite database.");
});

let sql; // Not strictly necessary to declare it here if defined in each function

//function to create catalog table (Assuming this is called elsewhere if needed)
function createCatalogTable() {
    sql = `CREATE TABLE IF NOT EXISTS catalog(ISBN INTEGER PRIMARY KEY,Title TEXT,Cost INTEGER,Topic TEXT,Stock INTEGER)`; // Added data types
    db.run(sql, (err) => {
        if (err) return console.error("❌ Error creating catalog table:", err.message);
        console.log("📖 Catalog table checked/created.");
    });
}

//function to insert data into the catalog table (Assuming this is for initial setup)
function insertIntoCatalog(title, cost, topic, stock) {
    sql = `INSERT INTO catalog (Title,Cost,Topic,Stock) VALUES(?,?,?,?)`;
    db.run(sql, [title, cost, topic, stock], (err) => {
        if (err)
            return console.error("❌ Error inserting into catalog:", err.message);
        // console.log(`📗 Inserted: ${title}`); // Optional log
    });
}

//function to search for item
function searchTopic(topic, callback) {
    sql = `SELECT * FROM catalog where Topic = ?`;
    // Removed redundant db.all call
    db.all(sql, [topic], (err, rows) => {
        if (err) {
            console.error("❌ SQL Error in searchTopic():", err.message);
            return callback(err, null);
        }
        callback(null, rows);
    });
}

//function to retrieve info about an item (MODIFIED)
function info(ISBN, callback) {
    const sql = `SELECT * FROM catalog WHERE ISBN = ?`;
    db.get(sql, [ISBN], (err, singleRow) => { // Changed to db.get
        if (err) {
            console.error("❌ SQL Error in info():", err.message);
            return callback(err, null);
        }
        // singleRow will be the book object if found, or undefined if not
        // console.log("🔎 Query Result for ISBN", ISBN, ":", singleRow); // Log can be verbose, optional
        callback(null, singleRow);
    });
}

//function to update the stock of an item (MODIFIED)
function updateStock(stock, ISBN, callback) {
    const sql = `UPDATE catalog SET Stock = ? WHERE ISBN = ?`;
    // Using 'function' to access 'this.changes'
    db.run(sql, [stock, ISBN], function (err) {
        if (err) {
            console.error("❌ SQL Error in updateStock():", err.message);
            return callback(err, null); // Pass null for changes on error
        }
        // console.log(`🔄 Stock updated for ISBN ${ISBN}. Rows affected: ${this.changes}`); // Optional log
        callback(null, this.changes); // Pass the number of rows affected
    });
}

module.exports = {
    createCatalogTable, // Ensure this is called somewhere if you need to create table on startup
    insertIntoCatalog, // Ensure this is used for initial data if needed
    searchTopic,
    info,
    updateStock,
    // Optional: export db if other parts of your app need direct access, but usually not needed.
    // db 
};