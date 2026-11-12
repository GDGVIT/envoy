import { json } from "@/lib/http";

/** Any /api path without its own route: answer in JSON like the rest of the API, not with the HTML 404 page. */
const notFound = () => json({ message: "This API endpoint doesn't exist.", code: "not_found" }, 404);

export const GET = notFound;
export const POST = notFound;
export const PUT = notFound;
export const PATCH = notFound;
export const DELETE = notFound;
