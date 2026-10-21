
import { randomBytes } from "node:crypto";
import { createLink } from "../repositories/links.repository.js";

export async function createShortLink(input) {
    const code =
        input.code ?? randomBytes(6).toString("base64url");

    return createLink({
        code,
        target_url: input.target_url,
        expires_at: input.expires_at ?? null,
    });
}
