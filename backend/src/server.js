require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const { connectDB } = require("./db");

const quotesRoutes = require("./routes/quotes");
const invoicesRoutes = require("./routes/invoices");
const projectsRoutes = require("./routes/projects");
const expensesRoutes = require("./routes/expenses");
const authRoutes = require("./routes/auth");
const reportsRoutes = require("./routes/reports");
const companyRoutes = require("./routes/company");
const zraRoutes = require("./routes/integrations/zra");
const { billingRouter, dodoWebhookHandler } = require("./routes/billing");
const { startZraSyncWorker } = require("./workers/zraWorker");
const branchesRoutes = require("./routes/branches");
const productsRoutes = require("./routes/products");
const stockRoutes = require("./routes/stock");
const usersRoutes = require("./routes/users");
const uploadsRoutes = require("./routes/uploads");
const { shouldAuditRequest, logAuditFromRequest } = require("./services/audit");
const { apiLimiter } = require("./middleware/rateLimit");

const app = express();
const corsOrigins = (process.env.CORS_ORIGIN || "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: corsOrigins,
    credentials: true
  })
);
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  })
);
app.post("/api/billing/dodo/webhook", express.raw({ type: "application/json" }), dodoWebhookHandler);
app.use(express.json({ limit: "10mb" }));
app.use("/api", apiLimiter);
app.use((req, res, next) => {
  if (!shouldAuditRequest(req)) return next();
  res.on("finish", () => {
    if (res.statusCode >= 400) return;
    logAuditFromRequest(req, res);
  });
  return next();
});

app.get("/", (_, res) => res.json({ ok: true, name: "invox-api" }));
app.get("/health", (_, res) => res.json({ ok: true, uptime: process.uptime() }));

app.use("/api/auth", authRoutes);
app.use("/api/company", companyRoutes);
app.use("/api/quotes", quotesRoutes);
app.use("/api/invoices", invoicesRoutes);
app.use("/api/projects", projectsRoutes);
app.use("/api/expenses", expensesRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/integrations/zra", zraRoutes);
app.use("/api/billing", billingRouter);
app.use("/api/users", usersRoutes);
app.use("/api/branches", branchesRoutes);
app.use("/api/products", productsRoutes);
app.use("/api/stock", stockRoutes);
app.use("/api/uploads", uploadsRoutes);

const port = process.env.PORT || 5000;
const requiredEnv = ["MONGO_URI", "PUBLIC_QUOTE_TOKEN_SECRET", "AUTH_JWT_SECRET"];
const missingEnv = requiredEnv.filter((key) => !process.env[key]);
if (missingEnv.length > 0) {
  console.error(`❌ Missing required env vars: ${missingEnv.join(", ")}`);
  process.exit(1);
}

connectDB(process.env.MONGO_URI)
  .then(() => {
    app.listen(port, () => console.log(`🚀 Running on http://localhost:${port}`));
    startZraSyncWorker();
  })
  .catch((err) => {
    console.error("❌ DB connect error:", err);
    process.exit(1);
  });
