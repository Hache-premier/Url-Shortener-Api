import { pool } from "../db.js";

export async function createLink({code, target_url, expires_at }) {
    const result = await pool.query(
        `INSERT INTO links (code, target_url,
        expires_at) VALUES ($1, $2, $3)
        RETURNING id, code, target_url, created_at, expires_at, click_count`,
        [code, target_url, expires_at ?? null],
    );

    return result.rows[0];

}
