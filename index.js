const express = require("express");
const cors = require('cors')
const  admin = require("firebase-admin");
require('dotenv').config();
const { MongoClient } = require('mongodb');

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});


const app = express();
const port = process.env.PORT || 5000;
//middleware
app.use(cors())
app.use(express.json())


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.9very.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });

async function verifyToken(req,res,next){
  if(req.headers?.authorization?.startsWith('Bearer ')){
    const token = req.headers.authorization.split(' ')[1];

    try{
      const decodedUser = await admin.auth().verifyIdToken(token)
      req.decodedEmail = decodedUser.email
    }
    catch{

    }

  }
  next();
}

async function run(){
try{
    await client.connect();
    const database = client.db('doctors_portal');
    const appointmentCollection  = database.collection('appointments');
    const usersCollection = database.collection('users')

  app.get('/appointments',verifyToken,async(req,res)=>{
    let query = {}
    const email = req.query.email;
    const date = new Date(req.query.date).toLocaleDateString();
    if(email){
      query = {email:req.query.email,date:date}
    }
    const appointments = await appointmentCollection.find(query).toArray()
    res.send(appointments)
  })

    app.post('/appointments',async(req,res)=>{
      const appointment = req.body;
      const result = await appointmentCollection.insertOne(appointment)
      res.json(result)
    })

    app.get('/users/:email', async(req,res)=>{
      const email = req.params.email;
      const filter = {email}
      const user = await usersCollection.findOne(filter);
      let isAdmin = false;
      if( user?.role === 'admin'){
        isAdmin = true;
      }
      res.send({admin:isAdmin})
    })

    app.post('/users',async(req,res)=>{
      const user = req.body
      const result = await usersCollection.insertOne(user)
      res.send(result)
    })

    app.put('/users', async (req, res) => {
      const user = req.body;
      const filter = { email: user.email };
      const options = { upsert: true };
      const updateDoc = { $set: user };
      const result = await usersCollection.updateOne(filter, updateDoc, options);
      res.json(result);
  });
  app.put('/users/admin',verifyToken,async(req,res)=>{
    const email = req.body.email
    const requester =   req.decodedEmail;
    if(requester){
      const requesterAccount = await usersCollection.findOne({email:requester})
      if(requesterAccount.role === 'admin'){
        const filter = {email:email};
        const updateDoc = {
          $set:{
            role:'admin'
          }
        } 
        const result = await usersCollection.updateOne(filter,updateDoc);
        res.send(result);
      }
    }
    else{
      res.status(403).json({message:'you do not have the permission to make admin'})
    }
    
  })

}
finally{
// await client.close();
}
}

run().catch(console.dir)

app.get("/", (req, res) => {
  res.send("Hello Doctors Portal!");
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
