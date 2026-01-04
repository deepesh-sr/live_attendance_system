import * as zod from 'zod';

export const validAttendance = zod.object({
    event : zod.string(),
    data : zod.object({
        studentId : zod.string(),
        status : zod.string()
    })
})

//zod validation 
export const signupSchema = zod.object({
    name: zod.string(),
    email: zod.string().email(),
    password: zod.string().min(6),
    role: zod.enum(["teacher", "student"])
})

export const loginSchema = zod.object({
    email: zod.string().email(),
    password: zod.string()
})

// class zod validation. 
export const validClass = zod.object({
    className: zod.string()
})

export const validClassId = zod.object({
    classId: zod.string()
})

// student validation
export const validStudent = zod.object({
    studentId: zod.string()
})