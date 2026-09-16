import jwt from 'jsonwebtoken';
import User from '../models/User.js';
export const auth=async(req,res,next)=>{try{const token=req.headers.authorization?.split(' ')[1];if(!token)return res.status(401).json({message:'Authentication required'});const decoded=jwt.verify(token,process.env.JWT_SECRET);req.user=await User.findById(decoded.id).select('-passwordHash');if(!req.user||req.user.status==='disabled')return res.status(401).json({message:'Account unavailable'});next();}catch(e){res.status(401).json({message:'Invalid or expired token'});}};
export const roles=(...allowed)=>(req,res,next)=>allowed.includes(req.user.role)?next():res.status(403).json({message:'Insufficient permissions'});
