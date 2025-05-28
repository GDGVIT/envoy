import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials"
import connectMongo from "@/utils/connectMongo";
import User from "@/modals/user";
import { comparePassword } from "@/utils/bcrypt";
import { sanitizeFilter } from "mongoose";

export const authOptions: NextAuthOptions = {
    providers:[
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                email: { label: "Email", type: "text" },
                password: { label: "Password", type: "password" }
            },
            async authorize(credentials) {
                if (!credentials) {
                    throw new Error("No credentials provided");
                }

                try {
                    await connectMongo();

                    const user = await User.findOne(sanitizeFilter({
                        $or: [
                            { email: credentials.email },
                            { username: credentials.email }
                        ]
                     })).select("+password");


                    if (!user) return null;

                    const isPasswordValid = await comparePassword(
                        credentials.password,
                        user.password
                    );

                    if (!isPasswordValid) return null;

                    return {
                        id: user._id.toString(),
                        name: user.name,
                        email: user.email,
                    };
                } catch (error) {
                    throw new Error((error as Error).message || "Authentication failed");
                }
            }
        })
    ],
    
    session: {
        strategy: "jwt",
        maxAge: 24 * 60 * 60, // 24 hours
    },

    secret: process.env.NEXTAUTH_SECRET,

    callbacks: {

        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
                token.email = user.email;
                token.name = user.name;
            }
            return token;
        },

        async session({ session, token }) {
            if (token?.id) {
                session.user.id = token.id.toString(); 
                session.user.email = token.email;
                session.user.name = token.name;
            }
            return session;
        },
    },


}