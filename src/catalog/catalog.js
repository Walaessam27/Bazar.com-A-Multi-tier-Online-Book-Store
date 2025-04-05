//import require modules
const express = require('express');                                               //1)import express module for bulding servers
const http =require('http');                                                      //2)import http module for http req
const DatabaseConfig = require('./dbconfig');                               //3)import databaseconfig to deal with database
const app = express();                                                            //create express app
const port= 4000;                                                                 //the port for front end server is 4000
app.use(express.json());                                                          //middleware to parse incoming json data

app.get('/search/:topic',(req,res)=>{                                              //get search req 
    DatabaseConfig.searchTopic(req.params.topic, (err, data) => {                 //call the serch method from databaseconfig to search for an item
        if (err) {
            res.status(500).send('Error fetching data from database');            //error handling
        } else {
            res.json(data);    
            console.log('Fetched successfully');
            console.log(data);
        }
    });
})

app.get('/info/:item_number',(req,res)=>{                                        //call the info method from databaseconfig to fetch data for item                 
    DatabaseConfig.info(req.params.item_number, (err, data) => {
        if (err) {
            res.status(500).send('Error fetching data from database');           //error handling
        } else {
            console.log('Fetched successfully');
            console.log(data);
            res.json(data);                                                      //if success send the data as a json
        }
    });
})

app.put('/update/:item_number',(req,res)=>{                                     // to update the stock of an item
    stock = req.body.Stock;                                                     //extract the stock from the body
    console.log( req.body.Stock);
    DatabaseConfig.updateStock(stock,req.params.item_number, (err) => {         //call the updateStock method from databaseconfig to update the stock of the item

        if (err) {
            res.status(500).send('Error fetching data from database');          //error handling
        } else {
            res.status(200).send('Updated');
        }
    });
})

app.listen(port,()=>{  
    console.log("Catalog server is running at 4000");                          // start the catalog server in port 4000 
})
