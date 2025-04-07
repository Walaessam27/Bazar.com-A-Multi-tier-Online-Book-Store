 // import Sqlite3 module
 const sqlite3 = require('sqlite3').verbose();
 // create a new Sqlite instance with read-write mode

 const path = require('path');
 const dbPath = path.join(__dirname, 'data.db');  // go one level up
 console.log("🧭 Using database at path:", dbPath);


const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
  if (err) {
    return console.error("❌ Failed to open DB:", err.message);
  }
  console.log("✅ Connected to the SQLite database.");
});

let sql;
 //function to create catalog table
function createCatalogTable(){                                                    
   sql = `CREATE TABLE IF NOT EXISTS catalog(ISBN INTEGER PRIMARY KEY,Title,Cost,Topic,Stock)`;
   db.run(sql)
}

//function to insert data into the catalog table
function insertIntoCatalog(title,cost,topic,stock){                           
   sql =`INSERT INTO catalog (Title,Cost,Topic,Stock) VALUES(?,?,?,?)`
   db.run(sql,[title,cost,topic,stock],(err)=>{
    if(err) 
    return console.error(err.message);
})
}
 //function to search for item
 function searchTopic(topic, callback){                                                                          
    sql=`SELECT * FROM catalog where Topic = ?`;
    db.all(sql,[topic],(err,rows)=>{
        db.all(sql, [topic], (err, rows) => {
            if (err) {
                callback(err, null);
            } else {
                callback(null, rows);
            }
        });
    })
    }  
 //function to retrieve info about an item 
 function info(ISBN, callback) {
    const sql = `SELECT * FROM catalog WHERE ISBN = ?`;
    db.all(sql, [ISBN], (err, row) => {
        if (err) {
            console.error("❌ SQL Error in info():", err.message);
            callback(err, null);
        } else {
            console.log("🔎 Query Result for ISBN", ISBN, ":", row);
            callback(null, row);
        }
    });
}

 //function to update the stock of an item 
function updateStock(stock,ISBN,callback){                                    
    sql=`UPDATE catalog SET Stock = ? where ISBN = ?`;
    db.run(sql,[stock,ISBN],(err)=>{

        if (err) {
            callback(err, null);
        } else {
            console.log("Stock updated successfully");
        }
    })
        
    }
    
    module.exports = {                                                    
        createCatalogTable,
        insertIntoCatalog,
        searchTopic,
        info,
        updateStock
     }