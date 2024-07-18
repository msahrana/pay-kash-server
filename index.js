const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const {MongoClient, ServerApiVersion, ObjectId} = require("mongodb");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;

const corsOptions = {
  origin: ["http://localhost:5173", "http://localhost:5174"],
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());
app.use(bodyParser.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.crgl3kb.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    const usersCollection = client.db("payKashDB").collection("users");

    /* Verify Token Middleware */
    const verifyToken = (req, res, next) => {
      const authHeader = req?.headers?.authorization;
      if (!authHeader) {
        return res.status(401).send("Unauthorized access");
      }
      const token = authHeader.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded) => {
        if (error) {
          return res.status(403).send({message: "forbidden access"});
        }
        req.decoded = decoded;
        next();
      });
    };

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = {email: email};
      const result = await usersCollection.findOne(query);
      const isAdmin = result?.user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({message: "forbidden access"});
      }
      next();
    };

    /* jwt api */
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "365d",
      });
      res.send({token});
    });

    app.get("/logout", async (req, res) => {
      try {
        res
          .clearCookie("token", {
            maxAge: 0,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
          })
          .send({success: true});
        console.log("Logout successful");
      } catch (err) {
        res.status(500).send(err);
      }
    });

    /* users api */
    app.post("/register", async (req, res) => {
      const user = req.body;
      console.log(user);
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    app.post("/login", async (req, res) => {
      const {email, pin} = req.body;
      try {
        await client.connect();
        const user = await usersCollection.findOne({email});
        if (!user) {
          return res
            .status(400)
            .json({success: false, message: "Invalid email or PIN"});
        }
        const isMatch = await bcrypt.compare(pin, user.pin);
        if (!isMatch) {
          return res
            .status(400)
            .json({success: false, message: "Invalid email or PIN"});
        }
        const token = jwt.sign({id: user._id}, "your_jwt_secret", {
          expiresIn: "1h",
        });
        res.json({success: true, token});
      } catch (error) {
        console.error(error);
        res.status(500).json({success: false, message: "Server error"});
      }
    });

    app.get("/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    app.get("/user/:id", async (req, res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = await usersCollection.findOne(query);
      res.send(result);
    });

    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("PayKash server is running");
});

app.listen(port, () => {
  console.log(`PayKash server is running on port: ${port}`);
});
