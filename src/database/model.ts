import mongoose, { Schema, model, connect, Types } from 'mongoose';

mongoose.Promise = global.Promise;

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

interface Attendance {
  _id: Types.ObjectId,
  classId: Types.ObjectId,
  studentId: Types.ObjectId,
  status: "present" | "absent"
}

//enum for role

export enum Role {
  Teacher = "teacher",
  Student = "student"
}

export enum Status {
  Present = "present",
  Absent = "absent"
}

const UserSchema = new Schema<User>({
  // _id: Schema.Types.ObjectId,
  name: String,
  email: String,
  password: String, // hashed with bcrypt
  role: {
    type: String,
    enum: Object.values(Role),
    required: true
  }
})

const ClassSchema = new Schema<Class>({
  // _id: Schema.Types.ObjectId,
  className: String,
  teacherId:{
    type : Types.ObjectId,
    ref : 'User'
  }, // reference to User
  studentIds:[{
    type : Types.ObjectId,
    ref : 'User' // array of User references
  }]
})

const AttendanceSchema = new Schema<Attendance>({
  _id: Types.ObjectId,
  classId: Types.ObjectId,
  studentId: Types.ObjectId,
  status: {
    type: String,
    enum: Object.values(Status),
    required: true
  }
})

export const User = mongoose.models.User || model<User>('User', UserSchema)
export const Class = mongoose.models.Class || model<Class>('Class', ClassSchema)
export const Attendance = mongoose.models.Attendance || model<Attendance>('Attendance', AttendanceSchema)