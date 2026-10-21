
import { Router } from "express";
import { createLinkController } from "../controllers/links.controller.js";

const linksRouter = Router();

linksRouter.post("/", createLinkController);

export default linksRouter;
