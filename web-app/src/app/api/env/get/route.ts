import { NextResponse } from "next/server";

/**
 * Legacy group-token endpoint. Group tokens were replaced by personal access tokens,
 * which respect each user's org/team role. See README → "CLI & API access".
 */
export function GET() {
    return NextResponse.json(
        {
            message:
                "This endpoint was removed. Create a personal access token in Account → API tokens and call GET /api/v1/{org}/{team}/{project}/{environment}.",
            code: "endpoint_removed",
        },
        { status: 410 }
    );
}
