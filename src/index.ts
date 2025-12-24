import express from 'express'
import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'
import mongoose from 'mongoose';
import * as zod from 'zod'
import { User } from './database/model.js';
import bcrypt from 'bcrypt'
import { authenticate } from './middleware/authenticate.js';
import Websocket, { WebSocketServer } from 'ws';
import { createServer } from 'http';

dotenv.config();

const app = express();
const server = createServer(app);

app.use(express.static('public'));

app.use(express.json());

//websocket server

const wss = new WebSocketServer({ server });

wss.on('connection', function connection(ws) {
    console.log("Connection established.");

    ws.on('message', function messgage(data) {
        const messageText = data.toString();
        console.log('Received', messageText);
        ws.send(`Echo : ${messageText}`);
    })

    ws.on('close', function close() {
        console.log('Client disconnected.')
    })
})

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

//testing ui for websocket
app.get('/', (req, res) => {
    // res.send(`
    //     <!DOCTYPE html>
    //     <html>
    //         <head>
    //             <title>Express WebSocket Demo</title>
    //             <style>
    //                 body { font-family: Arial, sans-serif; margin: 40px; }
    //                 #messages { border: 1px solid #ccc; height: 300px; 
    //                            overflow-y: scroll; padding: 10px; margin-bottom: 10px; }
    //                 #messageInput { width: 300px; padding: 5px; }
    //                 button { padding: 5px 10px; }
    //             </style>
    //         </head>
    //         <body>
    //             <h1>Express WebSocket Demo</h1>
    //             <div id="messages"></div>
    //             <input type="text" id="messageInput" placeholder="Enter your message">
    //             <button onclick="sendMessage()">Send Message</button>
    //             <script>
    //                 const ws = new WebSocket('ws://localhost:3000');
    //                 const messages = document.getElementById('messages');

    //                 ws.onmessage = function(event) {
    //                     const messageDiv = document.createElement('div');
    //                     messageDiv.textContent = event.data;
    //                     messages.appendChild(messageDiv);
    //                     messages.scrollTop = messages.scrollHeight;
    //                 };

    //                 function sendMessage() {
    //                     const input = document.getElementById('messageInput');
    //                     if (input.value) {
    //                         ws.send(input.value);
    //                         input.value = '';
    //                     }
    //                 }

    //                 document.getElementById('messageInput').addEventListener('keypress', function(e) {
    //                     if (e.key === 'Enter') {
    //                         sendMessage();
    //                     }
    //                 });
    //             </script>
    //         </body>
    //     </html>
    // `);

});

app.post('/auth/signup', async (req, res) => {
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
                    msg: "Email already exist."
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

app.post('/auth/login', async (req, res) => {
    const { username, email } = req.body;
    const user = await User.findOne({
        name: username,
        email: email
    })
    if (user) {
        if (process.env.JWT_SECRET) {
            const token = jwt.sign({
                "userid": user._id,
                "role": user.role
            }, process.env.JWT_SECRET)
            res.json({
                token: token
            })
        } else {
            console.error("JWT must be provided");
        }
    } else {
        res.status(401).json({
            msg: "User do not exist, please signup"
        })
    }

})

app.get('/auth/me', authenticate,async (req, res) => {
    const user = await User.findOne({
        // @ts-ignore
        _id : req.userid
    })
    res.json({
        //@ts-ignore
        userId: req.userid,
        user : user,
        msg: "auth route accessed"
    })
})

server.listen(3000, () => {
    console.log("App is listening of port 3000")
})