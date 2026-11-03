import { z } from "zod";

export const createLinkSchema = z.object({
    target_url: z.url({
        protocol: /^https?$/,
    }),
    code: z
        .string()
        .trim()
        .min(3)
        .max(16)
        .regex(/^[A-Za-z0-9_-]+$/)
        .refine(
            (code) =>
                !["health", "docs", "links"].includes(
                    code.toLowerCase(),
                ),
            {
                message: "This short code is reserved",
            },
        )
        .optional(),
    expires_at: z.iso
    .datetime({
        offset: true,
    })
    .refine(
        (expiresAt) => new Date(expiresAt).getTime() > Date.now(),
        {
            message: "Expiration date must be in the future",
        },
    )
    .optional(),
}).strict();

export const clickCursorSchema = z.object({
    id: z.number().int().positive(),
}).strict();

export const clickPaginationQuerySchema = z.object({
    after: z.preprocess(
        (value) => (value === "" ? undefined : value),
        z.string()
            .regex(/^[A-Za-z0-9_-]+$/, "Invalid pagination cursor")
            .optional(),
    ),
    limit: z.preprocess(
        (value) => (value === undefined ? "20" : value),
        z.string()
            .regex(/^\d+$/, "Limit must be a positive integer")
            .transform(Number)
            .pipe(z.number().int().min(1).max(100)),
    ),
});
