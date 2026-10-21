
import { Router } from "express";
import {
    createLinkController,
    getLinkMetadataController,
} from "../controllers/links.controller.js";

const linksRouter = Router();

linksRouter.post("/", createLinkController);
linksRouter.get("/:code", getLinkMetadataController);

export default linksRouter;
