import express from 'express'
import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'
import mongoose, { type ObjectId } from 'mongoose';
import { Attendance, Class, User } from './database/model.js';
import bcrypt from 'bcrypt'
import { authenticate, authenticateStudent, authenticateTeacher } from './middleware/authenticate.js';
import Websocket, { WebSocketServer } from 'ws';
import { createServer, IncomingMessage } from 'http';
import { parse } from 'url';
import { validAttendance, signupSchema, loginSchema, validClass, validClassId, validStudent } from './utils/zod.js';

dotenv.config();

const app = express();
const server = createServer(app);

app.use(express.static('public'));

app.use(express.json());

//websocket server

const wss = new WebSocketServer({ noServer: true });

const authenticateWss = (req: IncomingMessage) => {
    const { token } = parse(req.url || '', true).query;
    const jwtSecret = process.env.JWT_SECRET;
    if (!token || !jwtSecret) return null;

    try {
        if (token && jwtSecret) {
            const decodedMessage = jwt.verify(token as string, jwtSecret)
            return decodedMessage;
        }
    } catch (error) {
        return null;
    }
}

server.on('upgrade', (req, socket, head) => {

    const authed = authenticateWss(req)

    if (!authed) {
        // \r\n\r\n: These are control characters used in HTTP to
        // denote the end of the HTTP headers section.
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n')
        socket.destroy()
        return
    }

    //@ts-ignore
    req.user = authed;

    wss.handleUpgrade(req, socket, head, connection => {
        // Manually emit the 'connection' event on a WebSocket 
        // server (we subscribe to this event below).
        wss.emit('connection', connection, req)
    })
})
interface User {
    socket: Websocket,
    data: {
        event: string,
        data: {}
    }
}

let activeSession = {
    classId: "", // current active class
    startedAt: "", // ISO string
    attendance: {
        // studentId: status
    }
};



wss.on('connection', function connection(ws, req) {
    console.log("Connection established.");
    // @ts-ignore
    ws.user = req.user;
    //@ts-ignore
    console.log("ws user ", ws.user);

    ws.on('message', message => {

        let parsedMsg = JSON.parse(message as unknown as string);

        const result = validAttendance.safeParse(parsedMsg);

        if (!result.success) {
            console.error('Invalid message schema', result.error)
            ws.send(JSON.stringify({
                success: false,
                error: "Invalid msg schema"
            }))
        }
        // ----------------- Attendanceh marked --------------
        if (parsedMsg.event === 'ATTENDANCE_MARKED') {
            //@ts-ignore    
            if (ws.user.role !== "teacher") {
                ws.send(JSON.stringify({
                    "event": "ERROR",
                    "data": {
                        "message": "Forbidden, teacher event only"
                    }
                }))
            }


            if (activeSession.classId !== '') {
                //@ts-ignore
                activeSession.attendance[parsedMsg.data.studentId] = parsedMsg.data.status;
                console.log(activeSession);
                ws.send(JSON.stringify({
                    success: true,
                    data: {
                        "studentId": parsedMsg.data.studentId,
                        "status": parsedMsg.data.status
                    }
                }))
            }
            else {
                ws.send(JSON.stringify({
                    success: false,
                    error: "No active session"
                }))

            }
        }
        // evnet : Today summary 
        if (parsedMsg.event === 'TODAY_SUMMARY') {

            //@ts-ignore    
            if (ws.user.role !== "teacher") {
                ws.send(JSON.stringify({
                    "event": "ERROR",
                    "data": {
                        "message": "Forbidden, teacher event only"
                    }
                }))
            }
            //@ts-ignore
            const present = Object.keys(activeSession.attendance).filter(key => activeSession.attendance[key] === 'present');
            //@ts-ignore
            const absent = Object.keys(activeSession.attendance).filter(key => activeSession.attendance[key] === 'absent');

            ws.send(JSON.stringify({
                success: true,
                event: "TODAY_SUMMARY",
                data: {
                    "present": present.length,
                    "absent": absent.length,
                    "total": present.length + absent.length
                }
            }))
        }

        if (parsedMsg.event === 'MY_ATTENDANCE') {
            //@ts-ignore
            if (ws.user.role == 'student') {
            
            // @ts-ignore
            const result =  Object.keys(activeSession.attendance).filter(key => activeSession.attendance[key] === activeSession.attendance[ws.user.userid]);
            if(!result){
            
            }
            }
        }

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



app.get('/health', (req, res) => {
    res.send("Helloooooo")
})

//testing ui for websocket
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
            <head>
                <title>Express WebSocket Demo</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 40px; }
                    #messages { border: 1px solid #ccc; height: 300px; 
                               overflow-y: scroll; padding: 10px; margin-bottom: 10px; }
                    #messageInput { width: 300px; padding: 5px; }
                    button { padding: 5px 10px; }
                </style>
            </head>
            <body>
                <h1>Express WebSocket Demo</h1>
                <div id="messages"></div>
                <input type="text" id="messageInput" placeholder="Enter your message">
                <button onclick="sendMessage()">Send Message</button>
                <script>
                    const ws = new WebSocket('ws://localhost:3000');
                    const messages = document.getElementById('messages');

                    ws.onmessage = function(event) {
                        const messageDiv = document.createElement('div');
                        messageDiv.textContent = event.data;
                        messages.appendChild(messageDiv);
                        messages.scrollTop = messages.scrollHeight;
                    };

                    function sendMessage() {
                        const input = document.getElementById('messageInput');
                        if (input.value) {
                            ws.send(input.value);
                            input.value = '';
                        }
                    }

                    document.getElementById('messageInput').addEventListener('keypress', function(e) {
                        if (e.key === 'Enter') {
                            sendMessage();
                        }
                    });
                </script>
            </body>
        </html>
    `);

});

app.post('/auth/signup', async (req, res) => {
    try {
        const result = signupSchema.safeParse(req.body);

        if (!result.success) {
            console.error(result.error);
            return res.status(400).json({
                success: false,
                error: "Invalid request schema"
            })
        }

        const { name, email, password, role } = req.body;
        const userdata = await User.findOne({
            email: email
        });

        if (userdata) {
            return res.status(400).json({
                success: false,
                error: "Email already exists"
            })
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new User({
            name: name,
            email: email,
            password: hashedPassword,
            role: role
        })
        const saveResult = await newUser.save();
        if (saveResult) {
            res.status(201).json({
                success: true,
                data: {
                    _id: saveResult._id,
                    name: saveResult.name,
                    email: saveResult.email,
                    role: saveResult.role
                }
            })
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            error: "Internal server error"
        })
    }
})


app.post('/auth/login', async (req, res) => {
    try {
        const result = loginSchema.safeParse(req.body);

        if (!result.success) {
            return res.status(400).json({
                success: false,
                error: "Invalid request schema"
            })
        }

        const { email, password } = req.body;
        const user = await User.findOne({
            email: email
        })

        if (!user) {
            return res.status(400).json({
                success: false,
                error: "Invalid email or password"
            })
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(400).json({
                success: false,
                error: "Invalid email or password"
            })
        }

        if (process.env.JWT_SECRET) {
            const token = jwt.sign({
                userid: user._id,
                role: user.role
            }, process.env.JWT_SECRET)
            res.status(200).json({
                success: true,
                data: {
                    token: token
                }
            })
        } else {
            console.error("JWT must be provided");
            res.status(500).json({
                success: false,
                error: "Internal server error"
            })
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            error: "Internal server error"
        })
    }
})

app.get('/auth/me', authenticate, async (req, res) => {
    try {
        const user = await User.findOne({
            // @ts-ignore
            _id: req.userid
        })

        if (!user) {
            return res.status(404).json({
                success: false,
                error: "User not found"
            })
        }

        res.status(200).json({
            success: true,
            data: {
                _id: user._id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        })
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            error: "Internal server error"
        })
    }
})



app.post('/class', authenticateTeacher, async (req, res) => {
    try {
        const result = validClass.safeParse(req.body);

        if (!result.success) {
            console.error(result.error)
            return res.status(400).json({
                success: false,
                error: "Invalid request schema"
            })
        }

        const { className } = req.body;
        //@ts-ignore
        console.log(req.userid)

        const user = await User.findOne({
            // @ts-ignore
            _id: req.userid
        })

        if (!user) {
            return res.status(404).json({
                success: false,
                error: "User not found"
            })
        }

        if (user.role !== "teacher") {
            return res.status(403).json({
                success: false,
                error: "Forbidden, teacher access required"
            })
        }

        const already_existing_class = await Class.findOne({
            className: className
        })

        if (already_existing_class) {
            return res.status(400).json({
                success: false,
                error: "Class already exists"
            })
        }

        const newClass = new Class({
            className: className,
            teacherId: user._id,
            studentIds: []
        })

        const saveResult = await newClass.save();

        if (saveResult) {
            res.status(201).json({
                success: true,
                data: {
                    _id: saveResult._id,
                    className: saveResult.className,
                    teacherId: saveResult.teacherId,
                    studentIds: saveResult.studentIds
                }
            })
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            error: "Internal server error"
        })
    }
})

// get class by classid
app.get('/class/:id', authenticateTeacher, async (req, res) => {
    try {
        const user = await User.findOne({
            // @ts-ignore
            _id: req.userid
        })

        if (!user) {
            return res.status(404).json({
                success: false,
                error: "User not found"
            })
        }

        const already_existing_class = await Class.findOne({
            className: req.params['id']
        }).populate('teacherId')

        if (!already_existing_class) {
            return res.status(404).json({
                success: false,
                error: "Class not found"
            })
        }

        // Check if user is teacher who owns class OR student enrolled in class
        const isTeacher = user.role === "teacher" && already_existing_class.teacherId._id.toString() === user._id.toString();
        const isEnrolledStudent = user.role === "student" && already_existing_class.studentIds.some((id: any) => id.toString() === user._id.toString());

        if (!isTeacher && !isEnrolledStudent) {
            return res.status(403).json({
                success: false,
                error: "Forbidden, not class teacher"
            })
        }

        const studentsDetails = await Promise.all(already_existing_class.studentIds.map(async (id: any) => {
            const student = await User.findOne({
                _id: id.toString()
            })
            if (student) {
                return {
                    _id: student._id,
                    name: student.name,
                    email: student.email
                }
            }
            return null;
        }))

        const filteredStudents = studentsDetails.filter(s => s !== null);

        res.status(200).json({
            success: true,
            data: {
                _id: already_existing_class._id,
                className: already_existing_class.className,
                teacherId: already_existing_class.teacherId._id,
                students: filteredStudents
            }
        })
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            error: "Internal server error"
        })
    }
})

app.get('/auth/teacher', authenticateTeacher, async (req, res) => {
    res.json({
        msg: "welcome sir"
    })
})

app.post('/class/:id/add-student', authenticateTeacher, async (req, res) => {
    try {
        const result = validStudent.safeParse(req.body);

        if (!result.success) {
            console.error(result.error)
            return res.status(400).json({
                success: false,
                error: "Invalid request schema"
            })
        }

        const id = req.params['id'];
        const currentClass = await Class.findOne({
            className: id
        })

        if (!currentClass) {
            return res.status(404).json({
                success: false,
                error: "Class not found"
            })
        }

        // Check if the teacher owns the class
        //@ts-ignore
        if (currentClass.teacherId.toString() !== req.userid) {
            return res.status(403).json({
                success: false,
                error: "Forbidden, not class teacher"
            })
        }

        const student = await User.findOne({
            _id: req.body.studentId
        })

        if (!student) {
            return res.status(404).json({
                success: false,
                error: "Student not found"
            })
        }

        if (student.role !== "student") {
            return res.status(400).json({
                success: false,
                error: "User is not a student"
            })
        }

        // Check if student is already enrolled
        if (currentClass.studentIds.some((id: any) => id.toString() === student._id.toString())) {
            return res.status(400).json({
                success: false,
                error: "Student already enrolled"
            })
        }

        currentClass.studentIds.push(student._id);
        const saveResult = await currentClass.save();

        if (saveResult) {
            res.status(200).json({
                success: true,
                data: {
                    _id: currentClass._id,
                    className: currentClass.className,
                    teacherId: currentClass.teacherId,
                    studentIds: currentClass.studentIds
                }
            })
        }
    } catch (error) {
        console.error(error)
        res.status(500).json({
            success: false,
            error: "Internal server error"
        })
    }
})

app.get('/students', authenticateTeacher, async (req, res) => {
    try {
        const students = await User.find({
            role: "student"
        })

        const studentDetails = students.map((item) => {
            return {
                _id: item._id,
                name: item.name,
                email: item.email
            };
        })

        res.status(200).json({
            success: true,
            data: studentDetails
        })
    } catch (error) {
        console.error(error)
        res.status(500).json({
            success: false,
            error: "Internal server error"
        })
    }
})

app.get('/class/:id/my-attendance', authenticateStudent, async (req, res) => {

    try {
        const result = validClassId.safeParse(req.params['id']);
        if (result.success) {
            const currentClass = await Class.findOne({
                className: req.params['id']
            })
            // console.log(currentClass)
            // res.status(201).json({
            //     "success": true,
            //     "data": currentClass
            // })

            //@ts-ignore
            console.log(req.userid);
            if (currentClass) {
                const enrolledStudentId = currentClass.studentIds.filter((item: ObjectId) => {
                    //@ts-ignore
                    return item.toString() === req.userid;
                })
                const attendance = await Attendance.find({
                    studentId: enrolledStudentId
                })
                res.json({
                    data: attendance
                })
                console.log("attendance ", attendance);
                console.log("current class students ids ", currentClass.studentIds);
                console.log("enrolledstudent id : ", enrolledStudentId);
            } else {
                res.json({
                    msg: "Class doesn't exist"
                })
            }
        }

        else {
            console.error(result.error);
            res.status(401).json({
                msg: "invalid input"
            })

        }
    } catch (error) {
        console.error(error);
        res.status(401).json({
            msg: "Internal server error."
        })
    }
})


app.post('/attendance/start', authenticateTeacher, (req, res) => {

    try {

        const result = validClassId.safeParse(req.body);

        if (!result.success) {
            res.status(400).json({
                "success": false,
                "error": "Invalid request schema"
            })
        }

        const date = new Date();

        activeSession.classId = req.body.classId;
        activeSession.startedAt = date.toISOString();

        res.status(200).json({
            "success": true,
            "data": activeSession
        })

    } catch (error) {
        console.error(error);
        res.json({
            "success": false,
            "data": "internal server error",
            "error": error
        })
    }
})


server.listen(3000, () => {
    console.log("App is listening of port 3000")
})

