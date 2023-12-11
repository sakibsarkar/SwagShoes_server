require('dotenv').config()
const express = require("express")
const port = process.env.PORT || 5000
const app = express()
const jwt = require("jsonwebtoken")
const cors = require("cors")
const stripe = require("stripe")(process.env.STRIPE)
app.use(cors({
    origin: "http://localhost:5173",
    credentials: true
}))

app.use(express.json())



const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const { default: Stripe } = require('stripe')
const uri = `mongodb+srv://${process.env.MONGO_USER_NAME}:${process.env.MONGO_PASS}@cluster0.xbiw867.mongodb.net/?retryWrites=true&w=majority`;


// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});



const shoeCollection = client.db("swagShoes").collection("Shoes")
const userCollection = client.db("swagShoes").collection("userCollection")
const cartCollection = client.db("swagShoes").collection("cartCollection")
const orderCollection = client.db("swagShoes").collection("Orders")



//  user varify midlewere
const varifyUser = (req, res, next) => {
    const token = req.query.token
    if (!token) {
        return res.status(401).send({ messege: "unauthorized access" })
    }

    jwt.verify(token, process.env.TOKEN_SECRET, (err, decode) => {
        if (err) {
            return res.status(401).send({ messege: "unauthorized access" })
        }

        req.user = decode
        next()
    })
}

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();
        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });



        // ---------user related api-------------------


        // user token
        app.post("/api/user/token", async (req, res) => {
            const email = req.body
            if (!email) {
                return;
            }

            const token = jwt.sign(email, process.env.TOKEN_SECRET, {
                expiresIn: "365d"
            })

            res.send(token)


        })


        // --------user cart related api-----------

        // check is te item is already in user cart
        app.get("/api/user/check/cart", varifyUser, async (req, res) => {
            const id = req.query.id
            const email = req.user.email
            const size = parseInt(req.query.size)
            if (!id || !email || !size) {
                return res.send({ messege: "invalid credentials" })
            }
            const result = await cartCollection.findOne({ product_id: id, size: size, user_email: email })
            if (!result) {
                return res.send({ isExist: false })
            }


            res.send({ quantity: result.quantity, totalPrice: result.totalPrice, isExist: true, cart_id: result._id })
        })



        // update the cart item
        app.put("/api/update/cart", varifyUser, async (req, res) => {
            const { quantity, totalPrice, cart_id } = req.body

            const update = {
                $set: {
                    quantity: quantity,
                    totalPrice: totalPrice
                }
            }
            const find = {
                _id: new ObjectId(cart_id)
            }

            const result = await cartCollection.updateOne(find, update)
            res.send(result)
        })


        // add item on cart
        app.post("/api/user/cart/add", varifyUser, async (req, res) => {
            const cartData = req.body
            const result = await cartCollection.insertOne(cartData)
            return res.send(result)
        })

        // remove item From cart

        app.delete("/api/user/cart/delete", varifyUser, async (req, res) => {
            const id = req.query.id
            const find = {
                _id: new ObjectId(id),
                user_email: req.user.email
            }

            const result = await cartCollection.deleteOne(find)
            res.send(result)
        })


        // email based user cart items
        app.get("/api/mycart", varifyUser, async (req, res) => {
            const email = req.user.email

            if (!email) {
                return
            }

            const result = await cartCollection.find({ user_email: email }).toArray()
            res.send(result)
        })








        // --------- shoe realted api's -----------


        // new arrival shoes
        app.get("/api/newArrival", async (req, res) => {
            const find = { newArrival: true }

            const result = await shoeCollection.find(find).toArray()
            res.send(result)
        })



        // all shoes
        app.get("/api/all/shoes", async (req, res) => {
            const range = req.query.range
            const currentPage = req.query.currentPage ? req.query.currentPage : 0
            const skip = currentPage * 9

            // for all price range shoes
            if (range === "all") {
                const result = await shoeCollection.find().skip(skip).limit(9).toArray()
                const totalData = await shoeCollection.estimatedDocumentCount()
                return res.send({ result, totalData })
            }


            // for filter price range shoes
            const rangArray = range.split(",")
            const starRange = parseInt(rangArray[0])
            const endRange = parseInt(rangArray[1])


            const find = {
                price: {
                    $gte: starRange,
                    $lte: endRange
                }
            }

            const result = await shoeCollection.find(find).skip(skip).limit(9).toArray()
            const totalData = (await shoeCollection.find(find).toArray()).length
            res.send({ result, totalData })
        })


        // single shoe details
        app.get("/api/single/shoe", varifyUser, async (req, res) => {
            const id = req.query.id
            if (!id) {
                return res.send({ messege: "no product id found" })
            }
            const find = { _id: new ObjectId(id) }

            const result = await shoeCollection.findOne(find)
            res.send(result)
        })



        // ---------- stripe payment related api---------

        app.post("/api/stripe/payment", varifyUser, async (req, res) => {
            const { price } = req.body
            if (!price) {
                return
            }

            const ammount = parseInt(price) * 100
            const { client_secret } = await stripe.paymentIntents.create({
                amount: ammount,
                currency: "usd",
                payment_method_types: ["card"]
            })


            res.send({ client_secret })
        })



        // ------ oder related api----------
        app.post("/api/new/order", varifyUser, async (req, res) => {
            const obj = req.body


            const result = await orderCollection.insertOne(obj)
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