import { DB_NAME } from "../constent.js";
import mongoose from "mongoose";



const connectDB = async () => {
    try{
        const connectionInstance = await mongoose.connect(`${process.env.MONGO_URI} ${DB_NAME} `)
        console.log(`MongoDB connected !! DB Host  ${connectionInstance.connection.host}`);
    }
    catch(err){
        console.log("MongoDb connection error",err);
        process.exit(1);
    }
}

export default connectDB;