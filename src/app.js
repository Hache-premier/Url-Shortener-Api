
import "dotenv/config";
import express from "express";
import { pool } from "./db.js";
import linksRouter from "./routes/links.routes.js";
import { redirectLinkController } from "./controllers/links.controller.js";

const app = express();

app.use(express.json());

app.get("/health", async (req, res) => {
    try {
        await pool.query("SELECT 1");

        return res.status(200).json({
            status: "ok",
            database: "connected",
        });
    } catch (error) {
        console.error("Health check failed:", error.message);

        return res.status(503).json({
            status: "error",
            database: "unavailable",
        });
    }
});

app.use("/links", linksRouter);

app.get("/:code", redirectLinkController);

export default app;
