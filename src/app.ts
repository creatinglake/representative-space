import express from "express";
import type { Express } from "express";
import type { IncomingMessage } from "node:http";
import spaceRoutes from "./routes/spaceRoutes.js";
import outcomeRoutes from "./routes/outcomeRoutes.js";
import positionRoutes from "./routes/positionRoutes.js";
import eventRoutes from "./routes/eventRoutes.js";
import discoveryRoutes from "./routes/discoveryRoutes.js";
import debugRoutes from "./routes/debugRoutes.js";
import processRoutes from "./routes/processRoutes.js";
import deliberationRoutes from "./routes/deliberationRoutes.js";
import methodologyRoutes from "./routes/methodologyRoutes.js";
import citizenIssueRoutes from "./routes/citizenIssueRoutes.js";
import ledgerRoutes from "./routes/ledgerRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import { baseUrl } from "./utils/baseUrl.js";
import { bootProcessRegistry } from "./processes/boot.js";

export function createApp(): Express {
  return buildApp();
}

function buildApp(): Express {
const app = express();

// --- CORS ---

function parseOrigins(): Set<string> {
  const raw = process.env.RS_ALLOWED_ORIGINS;
  if (!raw) return new Set(["*"]);
  return new Set(
    raw
      .split(",")
      .map((o) => o.trim())
      .filter((o) => o.length > 0),
  );
}

const allowedOrigins = parseOrigins();

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (allowedOrigins.has("*")) {
    res.setHeader("Access-Control-Allow-Origin", "*");
  } else if (origin && allowedOrigins.has(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization",
  );
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  next();
});

// --- Body parsing ---

app.use(
  express.json({
    verify: (req: IncomingMessage, _res, buf) => {
      (req as any).rawBody = buf;
    },
  }),
);

// --- Routes ---

app.use("/space", spaceRoutes);
app.use("/space", outcomeRoutes);
app.use("/space", positionRoutes);
app.use("/space", citizenIssueRoutes);
app.use("/space", ledgerRoutes);
app.use("/events", eventRoutes);
app.use("/.well-known", discoveryRoutes);
app.use("/debug", debugRoutes);
app.use("/admin", adminRoutes);
app.use("/space", processRoutes);
app.use("/space", deliberationRoutes);
app.use(methodologyRoutes);

// --- Root ---

app.get("/", (_req, res) => {
  const hub = baseUrl();
  res.json({
    name: "Representative Space",
    version: "0.1.0",
    description:
      "Office-scoped civic space for elected officials and candidates",
    endpoints: {
      spaces: `${hub}/space`,
      events: `${hub}/events`,
      discovery: `${hub}/.well-known/civic.json`,
      health: `${hub}/health`,
    },
  });
});

// --- Health ---

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

bootProcessRegistry();

return app;
}

const app = buildApp();
export default app;
