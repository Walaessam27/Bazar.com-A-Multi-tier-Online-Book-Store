

// Create "order" table if it doesn't exist
const createOrderTable = `
  CREATE TABLE IF NOT EXISTS "order" (
    order_number INTEGER PRIMARY KEY,
    item_number
  )
`;

db.run(createOrderTable, (err) => {
    if (err) {
        console.error('Table creation failed:', err.message);
    } else {
        console.log('Order table ready.');
    }
});