import express from 'express'
import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'
import mongoose from 'mongoose';

dotenv.config();

const app = express();

app.use(express.json());

async function connectDB(){

    try {
        const monogodb_url= process.env.DB_URL;
        if(!monogodb_url) {
            throw new Error("DB URL must be provided")
        }
        await mongoose.connect(monogodb_url);
        console.log("DB connected");

    } catch (error) {
        console.error("Error connecting with database", error);
    }
}

connectDB();
app.get('/health', (req, res) => {
    console.log("Hello");
    res.send("Helloooooo")
})



app.post('/signin', (req, res) => {
    const { username, password } = req.body;
    if (process.env.JWT_SECRET) {
        const token = jwt.sign(username, process.env.JWT_SECRET)
        res.json({
            token: token
        })
    } else {
        console.error("JWT must be provided");
    }
})
app.listen(3000, () => {
    console.log("App is listening of port 3000")
})