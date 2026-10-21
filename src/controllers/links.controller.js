
import { createLinkSchema } from "../schemas/link.schema.js";
import { createShortLink } from "../services/links.service.js";

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
