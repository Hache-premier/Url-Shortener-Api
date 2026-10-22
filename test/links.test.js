import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, before, test } from "node:test";

const TEST_DATABASE = "url_shortener_test";

if (process.env.DB_NAME && process.env.DB_NAME !== TEST_DATABASE) {
    throw new Error(
        `Refusing to run tests: DB_NAME must be ${TEST_DATABASE}.`,
    );
}

process.env.NODE_ENV = "test";
process.env.DB_NAME = TEST_DATABASE;

const { default: app } = await import("../src/app.js");
const { pool } = await import("../src/db.js");

let server;
let baseUrl;

before(async () => {
    const result = await pool.query(
        "SELECT current_database() AS database",
    );

    assert.equal(
        result.rows[0]?.database,
        TEST_DATABASE,
        `Tests must use ${TEST_DATABASE}.`,
    );

    await pool.query(
        "TRUNCATE TABLE clicks, links RESTART IDENTITY CASCADE",
    );

    server = app.listen(0, "127.0.0.1");

    await new Promise((resolve, reject) => {
        server.once("listening", resolve);
        server.once("error", reject);
    });

    const address = server.address();

    assert.ok(address && typeof address === "object");

    baseUrl = `http://127.0.0.1:${address.port}`;
    process.env.BASE_URL = baseUrl;
});

after(async () => {
    try {
        if (server?.listening) {
            await new Promise((resolve, reject) => {
                server.close((error) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve();
                    }
                });
            });
        }

        const result = await pool.query(
            "SELECT current_database() AS database",
        );

        if (result.rows[0]?.database === TEST_DATABASE) {
            await pool.query(
                "TRUNCATE TABLE clicks, links RESTART IDENTITY CASCADE",
            );
        }
    } finally {
        await pool.end();
    }
});

async function postLink(body) {
    return fetch(`${baseUrl}/links`, {
        method: "POST",
        headers: {
            "content-type": "application/json",
        },
        body: JSON.stringify(body),
    });
}

async function createLink(options = {}) {
    const code =
        options.code ?? `test-${randomBytes(5).toString("hex")}`;

    const body = {
        target_url:
            options.target_url ?? "https://example.com/article",
        code,
        ...(options.expires_at !== undefined
            ? { expires_at: options.expires_at }
            : {}),
    };

    const response = await postLink(body);
    const payload = await response.json();

    return { response, payload, code };
}

test("GET /health confirms the database connection", async () => {
    const response = await fetch(`${baseUrl}/health`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(payload, {
        status: "ok",
        database: "connected",
    });
});

test("POST /links creates a link and GET metadata retrieves it", async () => {
    const { response, payload, code } = await createLink();

    assert.equal(response.status, 201);
    assert.equal(payload.code, code);
    assert.equal(payload.target_url, "https://example.com/article");
    assert.equal(payload.click_count, 0);
    assert.equal(payload.short_url, `${baseUrl}/${code}`);

    const metadataResponse = await fetch(`${baseUrl}/links/${code}`);
    const metadata = await metadataResponse.json();

    assert.equal(metadataResponse.status, 200);
    assert.equal(metadata.code, code);
    assert.equal(metadata.click_count, 0);
});

test("POST /links rejects invalid input and duplicate codes", async () => {
    const invalidUrlResponse = await postLink({
        target_url: "javascript:alert(1)",
        code: "invalid-url",
    });

    assert.equal(invalidUrlResponse.status, 400);

    const invalidCodeResponse = await postLink({
        target_url: "https://example.com",
        code: "bad code",
    });

    assert.equal(invalidCodeResponse.status, 400);

    const first = await createLink({
        code: "duplicate-test",
    });

    assert.equal(first.response.status, 201);

    const second = await createLink({
        code: "duplicate-test",
    });

    assert.equal(second.response.status, 409);
});

test("redirecting records a click and increments the counter", async () => {
    const { code } = await createLink();

    const redirectResponse = await fetch(`${baseUrl}/${code}`, {
        redirect: "manual",
        headers: {
            referer: "https://source.example/article",
            "user-agent": "url-shortener-test-agent",
        },
    });

    assert.equal(redirectResponse.status, 302);
    assert.equal(
        redirectResponse.headers.get("location"),
        "https://example.com/article",
    );

    const metadataResponse = await fetch(`${baseUrl}/links/${code}`);
    const metadata = await metadataResponse.json();

    assert.equal(metadata.click_count, 1);

    const clicksResponse = await fetch(
        `${baseUrl}/links/${code}/clicks?limit=10`,
    );
    const clickLog = await clicksResponse.json();

    assert.equal(clicksResponse.status, 200);
    assert.equal(clickLog.clicks.length, 1);
    assert.equal(
        clickLog.clicks[0].referrer,
        "https://source.example/article",
    );
    assert.equal(
        clickLog.clicks[0].user_agent,
        "url-shortener-test-agent",
    );
});

test("expired links return 410 without recording a click", async () => {
    const { response, code } = await createLink({
        expires_at: new Date(Date.now() - 60_000).toISOString(),
    });

    assert.equal(response.status, 201);

    const redirectResponse = await fetch(`${baseUrl}/${code}`, {
        redirect: "manual",
    });

    assert.equal(redirectResponse.status, 410);

    const metadataResponse = await fetch(`${baseUrl}/links/${code}`);
    const metadata = await metadataResponse.json();

    assert.equal(metadata.click_count, 0);
});

test("unknown links return 404", async () => {
    const metadataResponse = await fetch(
        `${baseUrl}/links/missing-test-link`,
    );
    const redirectResponse = await fetch(
        `${baseUrl}/missing-test-link`,
        { redirect: "manual" },
    );

    assert.equal(metadataResponse.status, 404);
    assert.equal(redirectResponse.status, 404);
});

test("click pagination uses a cursor without duplicating results", async () => {
    const { code } = await createLink();

    for (let index = 0; index < 3; index += 1) {
        const response = await fetch(`${baseUrl}/${code}`, {
            redirect: "manual",
        });

        assert.equal(response.status, 302);
    }

    const firstResponse = await fetch(
        `${baseUrl}/links/${code}/clicks?limit=2`,
    );
    const firstPage = await firstResponse.json();

    assert.equal(firstResponse.status, 200);
    assert.equal(firstPage.clicks.length, 2);
    assert.ok(firstPage.next_cursor);

    const secondResponse = await fetch(
        `${baseUrl}/links/${code}/clicks?limit=2&after=${encodeURIComponent(firstPage.next_cursor)}`,
    );
    const secondPage = await secondResponse.json();

    assert.equal(secondResponse.status, 200);
    assert.equal(secondPage.clicks.length, 1);
    assert.equal(secondPage.next_cursor, null);

    const allClicks = [...firstPage.clicks, ...secondPage.clicks];
    const uniqueIds = new Set(allClicks.map((click) => click.id));

    assert.equal(allClicks.length, 3);
    assert.equal(uniqueIds.size, 3);
});

test("click pagination rejects invalid cursors and oversized limits", async () => {
    const { code } = await createLink();

    const cursorResponse = await fetch(
        `${baseUrl}/links/${code}/clicks?after=not-a-valid-cursor`,
    );

    assert.equal(cursorResponse.status, 400);

    const limitResponse = await fetch(
        `${baseUrl}/links/${code}/clicks?limit=500`,
    );

    assert.equal(limitResponse.status, 400);
});

test("parallel redirects preserve the click counter", async () => {
    const { code } = await createLink();
    const numberOfClicks = 8;

    const responses = await Promise.all(
        Array.from({ length: numberOfClicks }, () =>
            fetch(`${baseUrl}/${code}`, {
                redirect: "manual",
            }),
        ),
    );

    assert.ok(responses.every((response) => response.status === 302));

    const metadataResponse = await fetch(`${baseUrl}/links/${code}`);
    const metadata = await metadataResponse.json();

    const clicksResponse = await fetch(
        `${baseUrl}/links/${code}/clicks?limit=100`,
    );
    const clickLog = await clicksResponse.json();

    assert.equal(metadata.click_count, numberOfClicks);
    assert.equal(clickLog.clicks.length, numberOfClicks);
});

test("click export returns a CSV file with recorded click data", async () => {
    const { code } = await createLink();

    await fetch(`${baseUrl}/${code}`, {
        redirect: "manual",
        headers: {
            referer: "https://source.example/csv",
            "user-agent": "csv-test-agent",
        },
    });

    const response = await fetch(
        `${baseUrl}/links/${code}/clicks.csv`,
    );
    const csv = await response.text();

    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /text\/csv/);
    assert.match(
        response.headers.get("content-disposition"),
        /attachment; filename="clicks\.csv"/,
    );
    assert.ok(csv.startsWith("id,clicked_at,referrer,user_agent\r\n"));
    assert.ok(csv.includes('"https://source.example/csv"'));
    assert.ok(csv.includes('"csv-test-agent"'));
});

test("deleting a link removes its associated click records", async () => {
    const { code, payload } = await createLink();

    await fetch(`${baseUrl}/${code}`, {
        redirect: "manual",
    });

    const deleteResponse = await fetch(`${baseUrl}/links/${code}`, {
        method: "DELETE",
    });

    assert.equal(deleteResponse.status, 204);

    const metadataResponse = await fetch(`${baseUrl}/links/${code}`);

    assert.equal(metadataResponse.status, 404);

    const clickCount = await pool.query(
        "SELECT COUNT(*)::int AS count FROM clicks WHERE link_id = $1",
        [payload.id],
    );

    assert.equal(clickCount.rows[0].count, 0);

    const secondDeleteResponse = await fetch(
        `${baseUrl}/links/${code}`,
        { method: "DELETE" },
    );

    assert.equal(secondDeleteResponse.status, 404);
});

test("SQL injection-like codes cannot expose other links or remove tables", async () => {
    const { code } = await createLink();

    const injection = encodeURIComponent("' OR '1'='1");
    const response = await fetch(`${baseUrl}/links/${injection}`);

    assert.equal(response.status, 404);

    const tables = await pool.query(`
        SELECT
            to_regclass('public.links') AS links_table,
            to_regclass('public.clicks') AS clicks_table
    `);

    assert.equal(tables.rows[0].links_table, "links");
    assert.equal(tables.rows[0].clicks_table, "clicks");

    const metadataResponse = await fetch(`${baseUrl}/links/${code}`);

    assert.equal(metadataResponse.status, 200);
});

test("GET /docs serves the Swagger UI page", async () => {
    const response = await fetch(`${baseUrl}/docs/`);
    const html = await response.text();

    assert.equal(response.status, 200);
    assert.match(
        response.headers.get("content-type") ?? "",
        /text\/html/,
    );
    assert.match(html, /swagger-ui/i);
});

test("GET /docs/openapi.yaml serves the OpenAPI specification", async () => {
    const response = await fetch(`${baseUrl}/docs/openapi.yaml`);
    const yaml = await response.text();

    assert.equal(response.status, 200);
    assert.match(
        response.headers.get("content-type") ?? "",
        /text\/yaml/,
    );
    assert.match(yaml, /^openapi: 3\.0\.3$/m);
    assert.match(yaml, /\/links\/\{code\}\/clicks\.csv/);
    assert.match(yaml, /\/health:/);
});
