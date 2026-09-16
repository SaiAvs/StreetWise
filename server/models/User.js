import mongoose from 'mongoose';
const schema = new mongoose.Schema({name:{type:String,required:true},email:{type:String,required:true,unique:true,lowercase:true},phone:String,passwordHash:{type:String,required:true},role:{type:String,enum:['citizen','authority','admin'],default:'citizen'},status:{type:String,enum:['active','disabled'],default:'active'}},{timestamps:true});
export default mongoose.model('User',schema);
