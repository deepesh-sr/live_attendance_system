import mongoose, { Schema, model, connect,Types } from 'mongoose';

interface User {
   _id: Types.ObjectId,
  name: String,
  email: String,
  password: String, // hashed with bcrypt
  role: "teacher" | "student" 
}

interface Class {
     _id: Types.ObjectId,
  className: String,
  teacherId: Types.ObjectId, // reference to User
  studentIds: [Types.ObjectId] // array of User references
}

interface Attendance{
    _id: Types.ObjectId,
  className: String,
  teacherId: Types.ObjectId, // reference to User
  studentIds: [Types.ObjectId] // array of User references
}

//enum for role

export enum Role{
    Teacher = "teacher",
    Student = "student"
}

const UserSchema = new Schema<User>({
  _id: Schema.Types.ObjectId,
  name: String,
  email: String,
  password: String, // hashed with bcrypt
  role: {
    type : String,
    enum : Object.values(Role),
    required : true
  }
})

const ClassSchema = new Schema<Class>({
  _id: Schema.Types.ObjectId,
  className: String,
  teacherId: Schema.Types.ObjectId, // reference to User
  studentIds: [Schema.Types.ObjectId] // array of User references
})

const AttendanceSchema = new Schema<Attendance>({
  _id: Schema.Types.ObjectId,
  className: String,
  teacherId: Schema.Types.ObjectId, // reference to User
  studentIds: [Schema.Types.ObjectId] // array of User references
})

export const User = model<User>('User',UserSchema)
export const Class = model<Class>('User',ClassSchema)
export const Attendance = model<Attendance>('User',AttendanceSchema)