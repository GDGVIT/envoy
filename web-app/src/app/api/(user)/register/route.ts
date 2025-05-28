import { NextResponse, NextRequest } from "next/server";
import User from "@/modals/user";
import connectMongo from "@/utils/connectMongo";
import { sanitizeFilter } from "mongoose";
import { hashPassword } from "@/utils/bcrypt";

export async function POST(request: NextRequest) {

    const { name, username, email, password } = await request.json();

    if (!name || !username || !email || !password) {
        return NextResponse.json({ message: "All fields are required" }, { status: 400 });
    }

    if(!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
        return NextResponse.json({ message: "Invalid email format." }, { status: 400 });
    }

    try {

        await connectMongo();

        const existingUser = await User.findOne(sanitizeFilter({ $or: [{ email }, { username }] }));

        if (existingUser) {
            return NextResponse.json({ message: "User with this email or username already exists." }, { status: 400 });
        }

        const hashedPassword = await hashPassword(password);

        const user = await User.create(sanitizeFilter({ name, email, username, password: hashedPassword }));

        const userObj = user.toObject();
        delete userObj.password;

        return NextResponse.json({ message: "User registered successfully.", user: userObj }, { status: 201 });

    } catch (error) {
        
        if (error instanceof Error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ error: "An unknown error occurred." }, { status: 500 });
    }

}