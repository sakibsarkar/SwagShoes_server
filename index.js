require('dotenv').config()
const express = require("express")
const port = process.env.PORT || 5000
const app = express()
const jwt = require("jsonwebtoken")
const cors = require("cors")
const stripe = require("stripe")(process.env.STRIPE)
app.use(cors({
    origin: ["https://swagshoes-a81f7.web.app", "https://swagshoes-a81f7.firebaseapp.com", "http://localhost:5173"],
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
const cancelOrderCollection = client.db("swagShoes").collection("cancelRequest")



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





        // ---varify admin midlewerer -----------

        const varifyAdmin = async (req, res, next) => {
            const email = req?.user?.email
            if (!email) {
                return res.send({ message: "can't authorized admin email" })

            }

            const result = await userCollection.findOne({ email: email })
            if (!result || result?.role !== "admin") {
                return res.status(401).send({ message: "forbiden acces" })
            }

            next()
        }




        //------ admin related api -------------


        // get order statistics
        app.get("/api/order/statistics", varifyUser, varifyAdmin, async (req, res) => {
            const result = await orderCollection.find().toArray()
            res.send(result)
        })


        // total pending orders
        app.get("/api/order/pending", varifyUser, varifyAdmin, async (req, res) => {
            const result = await orderCollection.find({ status: "pending" }).toArray()
            res.send({ pending: result.length })
        })


        // total shipped order 
        app.get("/api/order/shipped", async (req, res) => {
            const result = await orderCollection.find({ status: "shipped" }).toArray()
            res.send({ shipped: result.length })
        })


        // change order status
        app.put("/api/order/status", varifyUser, varifyAdmin, async (req, res) => {
            const { status, orderId } = req.body
            if (!status) {
                return
            }

            if (status === "pending") {
                const result = await orderCollection.updateOne(
                    { _id: new ObjectId(orderId) },
                    {
                        $set: {
                            status: "Ready to ship"
                        }
                    }
                )
                return res.send(result)
            }
            if (status === "Ready to ship") {
                const result = await orderCollection.updateOne(
                    { _id: new ObjectId(orderId) },
                    {
                        $set: {
                            status: "shipped"
                        }
                    }
                )
                return res.send(result)
            }
        })




        // shipped product price 
        app.get("/api/shipped/price", varifyUser, varifyAdmin, async (req, res) => {
            const result = await orderCollection.find({ status: "shipped" }, {
                projection: {
                    _id: 0,
                    price: 1
                }
            }).toArray()

            res.send(result)
        })



        // get all cancel request
        app.get("/api/cancel/request", varifyUser, varifyAdmin, async (req, res) => {
            const result = await cancelOrderCollection.find().toArray()
            res.send(result)
        })


        app.put("/api/cancel/requestResponse", varifyUser, varifyAdmin, async (req, res) => {
            const { action, req_id, cartId } = req.body
            if (action == "accepted") {
                const deleteRequest = await cancelOrderCollection.deleteOne({ _id: new ObjectId(req_id) })
                const deleteUserOrderList = await orderCollection.deleteOne({ _id: new ObjectId(cartId) })
                res.send({ message: "success" })
                return
            }

            if (action === "rejected") {
                const deleteRequest = await cancelOrderCollection.deleteOne({ _id: new ObjectId(req_id) })
                res.send(deleteRequest)
            }

            else {
                res.send({ message: "incomplete mission" })
            }


        })






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


        // -------- add user details after authentication
        app.put("/api/addUser", varifyUser, async (req, res) => {
            const { email } = req.user
            const userData = req.body
            const isExist = await userCollection.findOne({ email: email })
            if (isExist) {
                return res.send({ isExist: true })
            }

            const result = await userCollection.insertOne(userData)
            res.send(result)

        })



        // getUser role
        app.get("/api/user/role", varifyUser, async (req, res) => {

            // user email seted by varifyUser midlewere
            const email = req.user.email
            const result = await userCollection.findOne({ email: email }, {
                projection: {
                    _id: 0,
                    role: 1
                }
            })

            res.send(result)

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

        app.post("/api/newArrival", async (req, res) => {
            const find = { newArrival: true }

            const result = await shoeCollection.find(find).toArray()
            res.send(result)
        })

        // all shoes
        app.get("/api/all/shoes", async (req, res) => {
            const range = req.query.range || "0,999999"
            const rating = req.query.rating
            const isCoupon = req.query.isCoupon
            const currentPage = req.query.currentPage ? req.query.currentPage : 0
            const limit = req.query.limit ? parseInt(req.query.limit) : 9
            const skip = currentPage * limit


            // all price range shoes and has coupon


            // for filter price range shoes
            const rangArray = range.split(",")
            const starRange = parseInt(rangArray[0])
            const endRange = parseInt(rangArray[1])
            let find = {
                price: {
                    $gte: starRange,
                    $lte: endRange
                }
            }

            if (rating !== "all" && rating !== undefined) {
                const numberRating = parseInt(rating)
                let replica = {
                    ...find, ratings: {
                        $gte: numberRating,
                        $lt: numberRating + 1
                    }
                }
                find = replica

            }


            if (isCoupon === "true") {
                let replica = { ...find, coupon: { $ne: null } }
                find = replica
            }

            const result = await shoeCollection.find(find).skip(skip).limit(limit).toArray()
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


        // shoe (product) update
        app.put("/api/product/update", varifyUser, varifyAdmin, async (req, res) => {
            let { id, name, coupon, discountPercentage, price } = req.body
            if (!coupon) {
                coupon = null
            }
            if (!discountPercentage) {
                discountPercentage = null
            }

            if (discountPercentage) {
                discountPercentage = parseInt(discountPercentage)
            }

            const find = { _id: new ObjectId(id) }
            const update = {
                $set: {
                    name,
                    coupon,
                    discountPercentage,
                    price: parseFloat(price)
                }
            }
            const result = await shoeCollection.updateOne(find, update)
            res.send(result)

        })


        // add shoe (product)

        app.post("/api/add/product", varifyUser, varifyAdmin, async (req, res) => {
            let data = req.body
            data.price = parseFloat(data.price)
            const result = await shoeCollection.insertOne(data)
            res.send(result)
        })

        // delete shoe
        app.delete("/api/delete/product", varifyUser, varifyAdmin, async (req, res) => {
            const id = req.query.id
            const result = await shoeCollection.deleteOne({ _id: new ObjectId(id) })
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


        // add item on order list
        app.post("/api/new/order", varifyUser, async (req, res) => {
            const obj = req.body


            const result = await orderCollection.insertOne(obj)
            res.send(result)
        })

        // get ordered items (user based)

        app.get("/api/myOrders", varifyUser, async (req, res) => {
            const { email } = req.user
            if (!email) {
                return res.send({ messege: "no email found" })

            }

            const find = { user_email: email }
            const result = await orderCollection.find(find).toArray()

            res.send(result)


        })

        // cart pending order cancel api
        app.delete("/api/cancel/order", varifyUser, async (req, res) => {
            const id = req.query.id
            const find = { _id: new ObjectId(id) }
            const result = await orderCollection.deleteOne(find)
            res.send(result)
        })

        // request for cancel order

        app.post("/api/request/for/cancel", varifyUser, async (req, res) => {
            const body = req.body
            const id = req.query.id

            const check = await cancelOrderCollection.findOne({ requestId: id })
            if (check) {
                return res.send({ exist: true })
            }

            const result = await cancelOrderCollection.insertOne(body)
            res.send(result)
        })




        // ------product search related api-------------

        // product search by keywords
        app.get("/api/search/shoes", async (req, res) => {
            const searchValue = req.query.searchValue
            const order = req.query.order
            const isCoupon = req.query.isCoupon

            let find = {
                name: { $regex: new RegExp(searchValue, "i") }
            }

            if (isCoupon === "true") {
                find = {
                    name: { $regex: new RegExp(searchValue, "i") },
                    coupon: { $ne: null }
                }
            }


            if (!order) {
                const result = await shoeCollection.find(find).toArray()
                return res.send(result)

            }


            // descending order
            if (order === "dec") {
                const result = await shoeCollection.find(find).sort({ ["price"]: -1 }).toArray()
                return res.send(result)
            }

            if (order === "acc") {
                const result = await shoeCollection.find(find).sort({ ["price"]: 1 }).toArray()
                return res.send(result)
            }

        })


        // all shoe names

        app.get("/api/shoe/names", async (req, res) => {
            const projection = {
                _id: 0,
                name: 1
            }

            const result = await shoeCollection.find({}, { projection }).toArray()
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