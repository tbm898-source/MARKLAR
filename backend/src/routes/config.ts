import { Router } from "express";
import {
  DEFAULT_WORKERS,
  DEFAULT_SITES,
  ACTION_LABELS,
} from "../config/defaults.js";

export const configRouter = Router();

configRouter.get("/", (_req, res) => {
  res.json({
    workers: DEFAULT_WORKERS,
    sites: DEFAULT_SITES,
    actions: ACTION_LABELS,
  });
});
