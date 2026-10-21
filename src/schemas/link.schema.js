import { z } from "zod";

export const createLinkSchema = z.object({
    target_url: z.url({
        protocol: /^https?$/ ,
    }),
    code: z
        .string()
        .trim()
        .min(3)
        .max(16)
        .regex(/^[A-Za-z0-9_-]+$/)
        .optional(),
    expires_at: z.iso.datatime({
        off: true,
    }).optional(),
}).strict();
