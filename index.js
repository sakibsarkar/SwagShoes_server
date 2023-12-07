require('dotenv').config()
const express = require("express")
const port = process.env.PORT || 5000
const app = express()

const cors = require("cors")

app.use(cors({
    origin: "http://localhost:5173",
    credentials: true
}))

app.use(express.json())



const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = `mongodb+srv://${process.env.MONGO_USER_NAME}:${process.env.MONGO_PASS}@cluster0.xbiw867.mongodb.net/?retryWrites=true&w=majority`;


console.log(process.env.MONGO_PASS);

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});



const shoeCollection = client.db("swagShoes").collection("Shoes")


async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();
        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });


        app.get("/api/newArrival", async (req, res) => {
            const find = { newArrival: true }

            const result = await shoeCollection.find(find).toArray()
            res.send(result)
        })

        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);







app.get("/", async (req, res) => {
    res.send("server is running")
})

app.listen(port)