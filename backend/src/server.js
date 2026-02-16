require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { connectDB } = require("./db");

const quotesRoutes = require("./routes/quotes");
const invoicesRoutes = require("./routes/invoices");
const projectsRoutes = require("./routes/projects");
const expensesRoutes = require("./routes/expenses");
const authRoutes = require("./routes/auth");
const reportsRoutes = require("./routes/reports");
const companyRoutes = require("./routes/company");

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
app.use(express.json({ limit: "10mb" }));

app.get("/", (_, res) => res.json({ ok: true, name: "invox-api" }));

app.use("/api/auth", authRoutes);
app.use("/api/company", companyRoutes);
app.use("/api/quotes", quotesRoutes);
app.use("/api/invoices", invoicesRoutes);
app.use("/api/projects", projectsRoutes);
app.use("/api/expenses", expensesRoutes);
app.use("/api/reports", reportsRoutes);

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
  })
  .catch((err) => {
    console.error("❌ DB connect error:", err);
    process.exit(1);
  });
