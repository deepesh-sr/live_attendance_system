import type { Response, Request, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
    try {

        const token = req.headers['authorization'];

        if (!token) {
            return res.status(401).json({
                success: false,
                error: "Unauthorized, token missing or invalid"
            })
        }
        const jwtSecret = process.env.JWT_SECRET;
        if (token && jwtSecret) {
            const decodedMessage = jwt.verify(token, jwtSecret)
            // console.log(decodedMessage)
            //   @ts-ignore
            req.userid = decodedMessage.userid;
            next();
        }

    } catch (error) {
        console.error(error);
        res.status(401).json({
            success: false,
            error: "Unauthorized, token missing or invalid"
        })
    }
}
export const authenticateTeacher = async (req: Request, res: Response, next: NextFunction) => {
    try {

        const token = req.headers['authorization'];

        if (!token) {
            return res.status(401).json({
                success: false,
                error: "Unauthorized, token missing or invalid"
            })
        }
        const jwtSecret = process.env.JWT_SECRET;
        if (token && jwtSecret) {
            const decodedMessage = jwt.verify(token, jwtSecret)
            // console.log(decodedMessage)
            //   @ts-ignore
            req.role = decodedMessage.role;
            //@ts-ignore
            req.userid = decodedMessage.userid;
            //@ts-ignore
            if ( req.role == 'teacher'){
                next();
            }
            else { 
                res.status(403).json({
                    success: false,
                    error: "Forbidden, teacher access required"
                })
            }
        }

    } catch (error) {
        console.error(error);
        res.status(401).json({
            success: false,
            error: "Unauthorized, token missing or invalid"
        })
    }
}

export const authenticateStudent = async (req: Request, res: Response, next: NextFunction) => {
    try {

        const token = req.headers['authorization'];

        if (!token) {
            return res.status(401).json({
                success: false,
                error: "Unauthorized, token missing or invalid"
            })
        }
        const jwtSecret = process.env.JWT_SECRET;
        if (token && jwtSecret) {
            const decodedMessage = jwt.verify(token, jwtSecret)
            // console.log(decodedMessage)
            //   @ts-ignore
            req.role = decodedMessage.role;
            //@ts-ignore
            if ( req.role == 'student'){
                //@ts-ignore
                req.userid = decodedMessage.userid;
                //@ts-ignore
                // console.log(req.userid)
                next();
            }
            else { 
                res.status(403).json({
                    success: false,
                    error: "Forbidden, student access required"
                })
            }
        }

    } catch (error) {
        console.error(error);
        res.status(401).json({
            success: false,
            error: "Unauthorized, token missing or invalid"
        })
    }
}