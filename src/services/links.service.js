
import { randomBytes } from "node:crypto";
import {
    createLink,
    recordClickForCode,
    getLinkMetadataByCode,
    listClicksByLinkId,
} from "../repositories/links.repository.js";
import { clickCursorSchema } from "../schemas/link.schema.js";

export async function createShortLink(input) {
    const code =
        input.code ?? randomBytes(6).toString("base64url");

    return createLink({
        code,
        target_url: input.target_url,
        expires_at: input.expires_at ?? null,
    });
}

export async function recordShortLinkVisit(code, metadata = {}) {
    return recordClickForCode(code, metadata);
}

export async function getShortLinkMetadata(code) {
    return getLinkMetadataByCode(code);
}


export async function getShortLinkClicks(code, { after, limit }) {
    const link = await getLinkMetadataByCode(code);

    if (!link) {
        return { status: "not_found" };
    }

    let cursor = null;

    if (after) {
        let decodedCursor;

        try {
            const decodedText = Buffer.from(after, "base64url").toString(
                "utf8",
            );

            decodedCursor = JSON.parse(decodedText);
        } catch {
            return { status: "invalid_cursor" };
        }

        const parsedCursor = clickCursorSchema.safeParse(decodedCursor);

        if (!parsedCursor.success) {
            return { status: "invalid_cursor" };
        }

        cursor = parsedCursor.data;
    }

    const rows = await listClicksByLinkId(link.id, {
        after: cursor,
        limit: limit + 1,
    });

    const hasMore = rows.length > limit;
    const clicks = hasMore ? rows.slice(0, limit) : rows;

    let nextCursor = null;

    if (hasMore && clicks.length > 0) {
        const lastClick = clicks[clicks.length - 1];

        nextCursor = Buffer.from(
            JSON.stringify({
                clicked_at: new Date(lastClick.clicked_at).toISOString(),
                id: lastClick.id,
            }),
        ).toString("base64url");
    }

    return {
        status: "found",
        clicks,
        next_cursor: nextCursor,
    };
}
