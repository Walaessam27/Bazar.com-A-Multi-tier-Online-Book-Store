//import the require modules 
const express = require('express');          //1)import express module for bulding servers
const http =require('http');                 //2)import http module for http req
const axios = require('axios');              //3) import axios module for req also
const app = express();                       // create express app
const port= 3000;                           // the port for front end server is 3000

app.get('/search/:topic',(req,res)=>{       // if the req is search req route it based on topic
    try {
    http.get('http://catalog:4000/search/'+req.params.topic,( response)=>{         // get req to the catalog server to return the item
        response.on("data", (chunk)=>{
            const responseData = JSON.parse(chunk);                                  // parse to json format
            res.json(responseData)                                                   // return the response from catalog server
            console.log('Fetched successfully');
            console.log(responseData);
        });     
})
    }catch (error) {                                                                
        res.status(500).json({ error: error.message });                             // handle error if found
    }
})
app.get('/info/:item_number',(req,res)=>{                                           // if the req is info req route it based on item number          
    try {
    http.get('http://catalog:4000/info/'+req.params.item_number,(response)=>{     // get req to the catalog server to return the information about the item
        response.on("data", (chunk)=>{
            const responseData = JSON.parse(chunk);
            res.json(responseData)
            console.log('Fetched successfully');
            console.log(responseData);
        });   
})
}catch (error) {
    res.status(500).json({ error: error.message });                                //another handling 
}

})

app.post('/purchase/:item_number', async (req,res)=>{                                                       // if the req is purchase req route it based on item number     
    try {
        const response = await axios.post(`http://order:5000/purchase/${req.params.item_number}`);      // make an http post req to order server using axios
        console.log('Orderd successfully');
        console.log(response.data);
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
 
})
app.listen(port,()=>{                                                             // start the front end server
    console.log("Front end server is running at 3000");
})