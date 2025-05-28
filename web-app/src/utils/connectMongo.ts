import mongoose from "mongoose"

const uri = process.env.NEXT_MONGO_URI;

if(!uri){
    throw new Error('NEXT_MONGO_URI is not defined in environment variables');
}

export const connectMongo = async () => {

    try {

        if (mongoose.connection.readyState === 1) {
            return;
        }

        await mongoose.connect(uri);

    } catch (error) {
        console.log('MongoDB connection error:', error);
        throw new Error('MongoDB connection error');
    }

}