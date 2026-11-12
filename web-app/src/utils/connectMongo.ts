import mongoose from "mongoose";

mongoose.set("sanitizeFilter", true);

const uri = process.env.NEXT_MONGO_URI;

if (!uri) {
  throw new Error("NEXT_MONGO_URI is not defined in environment variables");
}

const connectMongo = async () => {
  try {
    if (mongoose.connection.readyState === 1) {
      return;
    }

    await mongoose.connect(uri);

    await Promise.all([
      import("@/models/user"),
      import("@/models/basicGroup"),
      import("@/models/organization"),
      import("@/models/orgMembership"),
      import("@/models/team"),
      import("@/models/teamMembership"),
      import("@/models/project"),
      import("@/models/environment"),
      import("@/models/invite"),
      import("@/models/apiToken"),
      import("@/models/auditLog"),
      import("@/models/passkey"),
    ]);

  } catch (error) {
    console.error("MongoDB connection error:", error);
    throw new Error("MongoDB connection error");
  }
};

export default connectMongo;
