import express from 'express'
import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'
import mongoose from 'mongoose';
import * as zod from 'zod'
import { User } from './database/model.js';
import bcrypt from 'bcrypt'
import { authenticate } from './middleware/authenticate.js';
import { ms } from 'zod/locales';

dotenv.config();

const app = express();

app.use(express.json());

async function connectDB() {

    try {
        const monogodb_url = process.env.DB_URL;
        if (!monogodb_url) {
            throw new Error("DB URL must be provided")
        }
        await mongoose.connect(monogodb_url);
        console.log("DB connected");

    } catch (error) {
        console.error("Error connecting with database", error);
    }
}
connectDB();

//zod validation 
const user = zod.object({
    username: zod.string(),
    email: zod.string(),
    password: zod.string()
        .min(8)
        .max(20)
        .refine((password) => /[A-Z]/.test(password))
        .refine((password) => /[a-z]/.test(password))
        .refine((p) => /[0-9]/.test(p))
        .refine((p) => /[!@#$%^&*]/.test(p)),
    role: zod.enum(["teacher", "student"])

})
app.get('/health', (req, res) => {
    console.log("Hello");
    res.send("Helloooooo")
})
app.post('/signup', async (req, res) => {
    try {
        const result = user.safeParse(req.body);

        if (result.success) {
            const { username, email, password, role } = req.body;
            const userdata = await User.findOne({
                username: username,
                email: email
            });

            if (userdata) {
                res.status(403).json({
                    msg: "User already exist"
                })
            }

            const hashedPassword = await bcrypt.hash(req.body.password, 2);

            const newUser = new User({
                name: username,
                email: email,
                password: hashedPassword,
                role: role
            })
            const saveResult = await newUser.save();
            if (saveResult) {
                res.status(200).json({ "msg": "Signed up" })
            }
        } else {
            console.error(result.error);
            res.status(411).json({
                message: "Invalid Inputs"
            })
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({
            msg: "server Error"
        })
    }
})

app.post('/signin', async (req, res) => {
    const { username, email } = req.body;
    const user = await User.findOne({
        name: username,
        email: email
    })
    if (user) {
        if (process.env.JWT_SECRET) {
            const token = jwt.sign({
                "userid" : user._id,
                "role" : user.role
            }, process.env.JWT_SECRET)
            res.json({
                token: token
            })
        } else {
            console.error("JWT must be provided");
        }
    }else{
        res.status(401).json({
            msg: "User do not exist, please signup"
        })
    }

})

app.get('/auth',authenticate,(req,res)=>{
    res.json({
        //@ts-ignore
        userId : req.userid,
        msg : "auth route accessed"
    })
})

app.listen(3000, () => {
    console.log("App is listening of port 3000")
})