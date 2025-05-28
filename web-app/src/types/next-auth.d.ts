import { DefaultSession, DefaultUser } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      accessToken?: string;
      isVerified?:boolean;
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    id: string;
    name?: string;
    email?: string;
    accessToken?: string;
    isVerified?:boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string
    isVerified?:boolean;
  }
}