
import { createLinkSchema } from "../schemas/link.schema.js";
import {
    createShortLink,
    recordShortLinkVisit,
    getShortLinkMetadata,
} from "../services/links.service.js";

export async function createLinkController(req, res) {
    const parsed = createLinkSchema.safeParse(req.body);

    if (!parsed.success) {
        return res.status(400).json({
            error: "Invalid request body",
            details: parsed.error.issues.map((issue) => ({
                path: issue.path.join("."),
                message: issue.message,
            })),
        });
    }

    try {
        const link = await createShortLink(parsed.data);
        const baseUrl =
            process.env.BASE_URL ??
            `${req.protocol}://${req.get("host")}`;

        return res.status(201).json({
            ...link,
            short_url: `${baseUrl}/${link.code}`,
        });
    } catch (error) {
        if (error.code === "23505") {
            return res.status(409).json({
                error: "That short code is already taken",
            });
        }

        console.error("Failed to create link:", error.message);

        return res.status(500).json({
            error: "Internal server error",
        });
    }
}

export async function getLinkMetadataController(req, res) {
    try {
        const link = await getShortLinkMetadata(req.params.code);

        if (!link) {
            return res.status(404).json({
                error: "Short link not found",
            });
        }

        return res.status(200).json(link);
    } catch (error) {
        console.error("Failed to fetch link metadata:", error.message);

        return res.status(500).json({
            error: "Internal server error",
        });
    }
}

export async function redirectLinkController(req, res) {
    try {
        const result = await recordShortLinkVisit(req.params.code, {
            referrer: req.get("referer"),
            userAgent: req.get("user-agent"),
        });

        if (result.status === "not_found") {
            return res.status(404).json({
                error: "Short link not found",
            });
        }

        if (result.status === "expired") {
            return res.status(410).json({
                error: "Short link has expired",
            });
        }

        return res.redirect(302, result.link.target_url);
    } catch (error) {
        console.error("Failed to redirect link:", error.message);

        return res.status(500).json({
            error: "Internal server error",
        });
    }
}
