const express = require("express");
const { z } = require("zod");
const Expense = require("../models/Expense");
const { ensureObjectId, parseDateOrThrow, parseOptionalDate, parseLimit, parsePage, handleRouteError } = require("./_helpers");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

const ExpenseCreateSchema = z.object({
  title: z.string().min(1),
  category: z.string().min(1),
  amount: z.number().nonnegative(),
  date: z.string().min(1),

  projectId: z.string().optional(),
  projectLabel: z.string().optional(),

  supplier: z.string().optional(),
  paidTo: z.string().optional(),
  paymentMethod: z.string().optional(),
  note: z.string().optional(),

  receipts: z.array(z.object({ url: z.string().url(), note: z.string().optional() })).optional()
});

const ExpenseUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  amount: z.number().nonnegative().optional(),
  date: z.string().optional(),

  projectId: z.string().optional(),
  projectLabel: z.string().optional(),

  supplier: z.string().optional(),
  paidTo: z.string().optional(),
  paymentMethod: z.string().optional(),
  note: z.string().optional(),

  receipts: z.array(z.object({ url: z.string().url(), note: z.string().optional() })).optional()
});

const ExpenseBulkSchema = z.object({
  text: z.string().min(1)
});

const ExpenseBulkProjectSchema = z.object({
  projectId: z.string().min(1),
  expenseIds: z.array(z.string()).optional(),
  filter: z
    .object({
      projectId: z.string().optional(),
      category: z.string().optional(),
      from: z.string().optional(),
      to: z.string().optional(),
      q: z.string().optional()
    })
    .optional()
});

function parseAmount(value) {
  const normalized = String(value).replace(/[,]/g, "").replace(/[^\d.-]/g, "");
  const num = Number(normalized);
  return Number.isFinite(num) ? num : NaN;
}

function parseDateFlexible(value) {
  const raw = String(value).trim();
  if (!raw) return null;

  const monthNames = {
    jan: 0,
    january: 0,
    feb: 1,
    february: 1,
    mar: 2,
    march: 2,
    apr: 3,
    april: 3,
    may: 4,
    jun: 5,
    june: 5,
    jul: 6,
    july: 6,
    aug: 7,
    august: 7,
    sep: 8,
    sept: 8,
    september: 8,
    oct: 9,
    october: 9,
    nov: 10,
    november: 10,
    dec: 11,
    december: 11
  };

  const monthName = raw.match(/^([A-Za-z]+)\.?\s+(\d{1,2}),?\s*(\d{4})$/);
  if (monthName) {
    const monthKey = monthName[1].toLowerCase();
    const day = Number(monthName[2]);
    const year = Number(monthName[3]);
    if (monthNames[monthKey] !== undefined) {
      const date = new Date(year, monthNames[monthKey], day);
      if (!Number.isNaN(date.getTime())) return date;
    }
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const date = new Date(raw);
    if (!Number.isNaN(date.getTime())) return date;
  }

  const slash = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (slash) {
    const a = Number(slash[1]);
    const b = Number(slash[2]);
    const y = Number(slash[3]);
    const isDayFirst = a > 12;
    const month = isDayFirst ? b : a;
    const day = isDayFirst ? a : b;
    const date = new Date(y, month - 1, day);
    if (!Number.isNaN(date.getTime())) return date;
  }

  const short = raw.match(/^(\d{1,2})[\/-](\d{1,2})$/);
  if (short) {
    const now = new Date();
    const a = Number(short[1]);
    const b = Number(short[2]);
    const isDayFirst = a > 12;
    const month = isDayFirst ? b : a;
    const day = isDayFirst ? a : b;
    const date = new Date(now.getFullYear(), month - 1, day);
    if (!Number.isNaN(date.getTime())) return date;
  }

  if (/^\d{1,2}$/.test(raw)) {
    const now = new Date();
    const day = Number(raw);
    const date = new Date(now.getFullYear(), now.getMonth(), day);
    if (!Number.isNaN(date.getTime())) return date;
  }

  return null;
}

function splitColumns(line) {
  if (line.includes("\t")) {
    return line.split(/\t+/).map((part) => part.trim()).filter(Boolean);
  }
  if (/\s{2,}/.test(line)) {
    return line.split(/\s{2,}/).map((part) => part.trim()).filter(Boolean);
  }
  return null;
}

function parseFromColumns(columns, headerMap) {
  if (!columns || columns.length === 0) return { error: "Missing columns" };

  if (headerMap) {
    const title = columns[headerMap.title] || "";
    const category = columns[headerMap.category] || "";
    const amount = parseAmount(columns[headerMap.amount]);
    const date = parseDateFlexible(columns[headerMap.date]);
    if (!title) return { error: "Missing title" };
    if (!category) return { error: "Missing category" };
    if (!Number.isFinite(amount) || amount < 0) return { error: "Invalid amount" };
    if (!date) return { error: "Invalid date" };
    return { title, amount, category, date };
  }

  if (columns.length >= 4) {
    const title = columns[0];
    const category = columns[1];
    const amount = parseAmount(columns[2]);
    const date = parseDateFlexible(columns[3]);
    if (title && category && Number.isFinite(amount) && amount >= 0 && date) {
      return { title, amount, category, date };
    }
  }

  // Flexible: find date and amount from right to left to handle split date columns
  let date = null;
  let dateIndex = -1;
  for (let i = columns.length - 1; i >= 0; i -= 1) {
    const candidate = columns.slice(i).join(" ").trim();
    const parsed = parseDateFlexible(candidate);
    if (parsed) {
      date = parsed;
      dateIndex = i;
      break;
    }
  }
  if (!date) return { error: "Invalid date" };

  const beforeDate = columns.slice(0, dateIndex);
  if (beforeDate.length < 3) return { error: "Missing title or category" };

  let amount = NaN;
  let amountIndex = -1;
  for (let i = beforeDate.length - 1; i >= 0; i -= 1) {
    const parsedAmount = parseAmount(beforeDate[i]);
    if (Number.isFinite(parsedAmount)) {
      amount = parsedAmount;
      amountIndex = i;
      break;
    }
  }
  if (!Number.isFinite(amount) || amountIndex < 0) return { error: "Invalid amount" };

  const category = beforeDate[amountIndex - 1];
  const title = beforeDate.slice(0, amountIndex - 1).join(" ").trim();
  if (!title) return { error: "Missing title" };
  if (!category) return { error: "Missing category" };
  return { title, amount, category, date };
}

function detectHeaderMap(line) {
  const normalized = line.toLowerCase();
  const hasAll = ["title", "category", "amount", "date"].every((key) => normalized.includes(key));
  if (!hasAll) return null;

  const parts = splitColumns(line);
  if (!parts || parts.length < 4) return { map: null, isHeader: true };
  const map = {};
  parts.forEach((part, index) => {
    const value = part.toLowerCase();
    if (value.includes("title")) map.title = index;
    if (value.includes("category")) map.category = index;
    if (value.includes("amount")) map.amount = index;
    if (value.includes("date")) map.date = index;
  });
  if (map.title === undefined || map.category === undefined || map.amount === undefined || map.date === undefined) {
    return { map: null, isHeader: true };
  }
  return { map, isHeader: true };
}

function parseExpenseLine(line, headerMap = null) {
  if (!line) return { error: "Empty line" };

  const lowerLine = line.toLowerCase();
  if (["title", "category", "amount", "date"].every((key) => lowerLine.includes(key))) {
    return { error: "Header row" };
  }

  const dateAtStartMatch = line.match(
    /^\s*([A-Za-z]+\.?\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})\s*[-–]?\s*(.+)$/i
  );
  if (dateAtStartMatch) {
    const date = parseDateFlexible(dateAtStartMatch[1]);
    const rest = dateAtStartMatch[2].trim();
    const amountMatch = rest.match(/-?\d[\d,]*(?:\.\d+)?\s*$/);
    const amount = amountMatch ? parseAmount(amountMatch[0]) : NaN;
    const title = amountMatch ? rest.slice(0, amountMatch.index).trim() : rest;
    if (!date) return { error: "Invalid date" };
    if (!title) return { error: "Missing title" };
    if (!Number.isFinite(amount) || amount < 0) return { error: "Invalid amount" };
    return { title, amount, category: "Other", date };
  }

  const columns = splitColumns(line);
  if (columns && columns.length >= 3) {
    const columnResult = parseFromColumns(columns, headerMap);
    if (!columnResult.error) return columnResult;
  }

  if (line.includes("|")) {
    const parts = line.split("|").map((part) => part.trim()).filter(Boolean);
    if (parts.length < 4) {
      return { error: "Expected: title | amount | category | date" };
    }
    const title = parts[0];
    const amount = parseAmount(parts[1]);
    const category = parts[2];
    const date = parseDateFlexible(parts.slice(3).join(" | "));
    if (!title) return { error: "Missing title" };
    if (!category) return { error: "Missing category" };
    if (!Number.isFinite(amount) || amount < 0) return { error: "Invalid amount" };
    if (!date) return { error: "Invalid date" };
    return { title, amount, category, date };
  }

  const monthDateRegex =
    /(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)\.?\s+\d{1,2},?\s+\d{4}/i;
  const numericDateRegex = /\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}[\/-]\d{1,2}[\/-]\d{4}\b/;
  const dateMatch = line.match(monthDateRegex) || line.match(numericDateRegex);
  if (dateMatch) {
    const dateText = dateMatch[0];
    const beforeDate = line.slice(0, dateMatch.index).trim();
    const amountMatches = Array.from(beforeDate.matchAll(/-?\d[\d,]*(?:\.\d+)?/g));
    if (amountMatches.length === 0) return { error: "Invalid amount" };
    const lastAmountMatch = amountMatches[amountMatches.length - 1];
    const amount = parseAmount(lastAmountMatch[0]);
    const date = parseDateFlexible(dateText);
    if (!Number.isFinite(amount) || amount < 0) return { error: "Invalid amount" };
    if (!date) return { error: "Invalid date" };

    const left = beforeDate.slice(0, lastAmountMatch.index).trim();
    const tokens = left.split(/\s+/).filter(Boolean);
    if (tokens.length < 2) return { error: "Missing title or category" };
    const categoryToken = tokens[tokens.length - 1];
    const title = tokens.slice(0, -1).join(" ").trim();
    if (!title) return { error: "Missing title" };
    if (!categoryToken) return { error: "Missing category" };
    return { title, amount, category: categoryToken, date };
  }

  const tokens = line.split(/\s+/).filter(Boolean);
  if (tokens.length < 4) {
    return { error: "Expected: title amount category date (space separated)" };
  }
  const dateToken = tokens[tokens.length - 1];
  const categoryToken = tokens[tokens.length - 2];
  const amountToken = tokens[tokens.length - 3];
  const titleTokens = tokens.slice(0, -3);
  const title = titleTokens.join(" ").trim();
  const amount = parseAmount(amountToken);
  const date = parseDateFlexible(dateToken);
  if (!title) return { error: "Missing title" };
  if (!categoryToken) return { error: "Missing category" };
  if (!Number.isFinite(amount) || amount < 0) return { error: "Invalid amount" };
  if (!date) return { error: "Invalid date" };
  return { title, amount, category: categoryToken, date };
}

function buildDateKey(date) {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildExpenseKey(expense) {
  const amount = Number(expense.amount || 0).toFixed(2);
  const dateKey = buildDateKey(expense.date);
  return `${amount}|${dateKey}`;
}

function dayStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dayEnd(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function explodeLineByDate(line) {
  const dateRegex =
    /\b(?:\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{4}-\d{2}-\d{2}|(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)\.?\s+\d{1,2},?\s+\d{4})\b/gi;
  const matches = [];
  let match = dateRegex.exec(line);
  while (match) {
    matches.push({ index: match.index });
    match = dateRegex.exec(line);
  }
  if (matches.length <= 1) return [line];

  const segments = [];
  for (let i = 0; i < matches.length; i += 1) {
    const start = matches[i].index;
    const end = i + 1 < matches.length ? matches[i + 1].index : line.length;
    const segment = line.slice(start, end).trim();
    if (segment) segments.push(segment);
  }
  return segments.length > 0 ? segments : [line];
}

router.post("/", async (req, res) => {
  try {
    const parsed = ExpenseCreateSchema.parse(req.body);
    const date = parseDateOrThrow(parsed.date, "date");

    const expense = await Expense.create({
      title: parsed.title,
      category: parsed.category,
      amount: parsed.amount,
      date,
      companyId: req.user.companyId,
      projectId: parsed.projectId || null,
      projectLabel: parsed.projectLabel,
      supplier: parsed.supplier,
      paidTo: parsed.paidTo,
      paymentMethod: parsed.paymentMethod,
      note: parsed.note,
      receipts: parsed.receipts || []
    });

    res.status(201).json({ expense });
  } catch (err) {
    return handleRouteError(res, err, "Failed to create expense");
  }
});

router.post("/bulk", async (req, res) => {
  try {
    if (!req.user.companyId) {
      return res.status(400).json({ error: "Account missing company profile. Update settings or re-register." });
    }
    const parsed = ExpenseBulkSchema.parse(req.body);
    const rawLines = parsed.text
      .split(/\r?\n/)
      .map((line) =>
        line
          .replace(/[\u200B-\u200F\uFEFF\u2060\u00AD\u202A-\u202E\u2066-\u2069]/g, "")
          .replace(/[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g, " ")
          .trim()
      )
      .filter((line) => line.length > 0);
    let lines = rawLines.flatMap((line) => explodeLineByDate(line));
    let headerMap = null;
    if (lines.length > 0) {
      const header = detectHeaderMap(lines[0]);
      if (header?.isHeader) {
        headerMap = header.map;
        lines = lines.slice(1);
      }
    }
    const docs = [];
    const errors = [];
    const skipped = [];
    const seenKeys = new Set();

    lines.forEach((line, index) => {
      const result = parseExpenseLine(line, headerMap);
      if (result.error) {
        if (result.error !== "Header row") {
          errors.push({ line: index + 1, error: result.error, raw: line });
        }
        return;
      }
      const doc = {
        _line: index + 1,
        title: result.title,
        category: result.category,
        amount: result.amount,
        date: result.date,
        companyId: req.user.companyId,
        receipts: []
      };
      const key = buildExpenseKey(doc);
      if (seenKeys.has(key)) {
        skipped.push({ line: index + 1, error: "Duplicate in paste", raw: line });
        return;
      }
      seenKeys.add(key);
      docs.push(doc);
    });

    if (docs.length > 0) {
      const dates = docs.map((doc) => doc.date);
      const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
      const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));
      const amountSet = [...new Set(docs.map((doc) => doc.amount))];
      const existing = await Expense.find({
        companyId: req.user.companyId,
        date: { $gte: dayStart(minDate), $lte: dayEnd(maxDate) },
        amount: { $in: amountSet }
      })
        .select("title category amount date")
        .lean();

      if (existing.length > 0) {
        const existingKeys = new Set(existing.map((exp) => buildExpenseKey(exp)));
        const filtered = [];
        docs.forEach((doc) => {
          const key = buildExpenseKey(doc);
          if (existingKeys.has(key)) {
            skipped.push({ line: doc._line, error: "Already exists", raw: doc.title });
            return;
          }
          filtered.push(doc);
        });
        docs.length = 0;
        docs.push(...filtered);
      }
    }

    if (docs.length === 0) {
      return res.json({ createdCount: 0, errors, skipped });
    }

    const insertDocs = docs.map(({ _line, ...rest }) => rest);
    const created = await Expense.insertMany(insertDocs);
    res.status(201).json({
      createdCount: created.length,
      errors,
      skipped
    });
  } catch (err) {
    return handleRouteError(res, err, "Failed to import expenses");
  }
});

router.put("/bulk/project", async (req, res) => {
  try {
    const parsed = ExpenseBulkProjectSchema.parse(req.body);
    ensureObjectId(parsed.projectId, "project id");

    const Project = require("../models/Project");
    const project = await Project.findOne({ _id: parsed.projectId, companyId: req.user.companyId }).lean();
    if (!project) return res.status(404).json({ error: "Project not found" });

    const update = {
      projectId: parsed.projectId,
      projectLabel: project.name
    };

    if (parsed.expenseIds && parsed.expenseIds.length > 0) {
      parsed.expenseIds.forEach((id) => ensureObjectId(id, "expense id"));
      const result = await Expense.updateMany(
        { _id: { $in: parsed.expenseIds }, companyId: req.user.companyId },
        update
      );
      return res.json({ updatedCount: result.modifiedCount ?? result.nModified ?? 0 });
    }

    if (parsed.filter) {
      const filter = {};
      if (parsed.filter.projectId) {
        ensureObjectId(parsed.filter.projectId, "project id");
        filter.projectId = parsed.filter.projectId;
      }
      if (parsed.filter.category) filter.category = parsed.filter.category;
      if (parsed.filter.q) filter.title = { $regex: String(parsed.filter.q), $options: "i" };
      if (parsed.filter.from || parsed.filter.to) {
        filter.date = {};
        const fromDate = parseOptionalDate(parsed.filter.from, "from");
        const toDate = parseOptionalDate(parsed.filter.to, "to");
        if (fromDate) filter.date.$gte = fromDate;
        if (toDate) filter.date.$lte = toDate;
      }

      const result = await Expense.updateMany({ ...filter, companyId: req.user.companyId }, update);
      return res.json({ updatedCount: result.modifiedCount ?? result.nModified ?? 0 });
    }

    return res.status(400).json({ error: "Provide expenseIds or filter" });
  } catch (err) {
    return handleRouteError(res, err, "Failed to assign expenses to project");
  }
});

router.put("/:id", async (req, res) => {
  try {
    ensureObjectId(req.params.id, "expense id");
    const parsed = ExpenseUpdateSchema.parse(req.body);
    const expense = await Expense.findOne({ _id: req.params.id, companyId: req.user.companyId });
    if (!expense) return res.status(404).json({ error: "Expense not found" });

    if (parsed.projectId !== undefined && parsed.projectId) {
      ensureObjectId(parsed.projectId, "project id");
    }

    if (parsed.title !== undefined) expense.title = parsed.title;
    if (parsed.category !== undefined) expense.category = parsed.category;
    if (parsed.amount !== undefined) expense.amount = parsed.amount;
    if (parsed.date !== undefined) expense.date = parseDateOrThrow(parsed.date, "date");

    if (parsed.projectId !== undefined) expense.projectId = parsed.projectId || null;
    if (parsed.projectLabel !== undefined) expense.projectLabel = parsed.projectLabel;

    if (parsed.supplier !== undefined) expense.supplier = parsed.supplier;
    if (parsed.paidTo !== undefined) expense.paidTo = parsed.paidTo;
    if (parsed.paymentMethod !== undefined) expense.paymentMethod = parsed.paymentMethod;
    if (parsed.note !== undefined) expense.note = parsed.note;

    if (parsed.receipts !== undefined) expense.receipts = parsed.receipts;

    await expense.save();
    res.json({ expense });
  } catch (err) {
    return handleRouteError(res, err, "Failed to update expense");
  }
});

// List expenses with filters: projectId, category, from, to, q (title)
router.get("/", async (req, res) => {
  try {
    const { projectId, category, from, to, q, limit, page } = req.query;

    const filter = {};
    if (projectId) {
      ensureObjectId(projectId, "project id");
      filter.projectId = projectId;
    }
    if (category) filter.category = category;
    if (q) filter.title = { $regex: String(q), $options: "i" };

    if (from || to) {
      filter.date = {};
      const fromDate = parseOptionalDate(from, "from");
      const toDate = parseOptionalDate(to, "to");
      if (fromDate) filter.date.$gte = fromDate;
      if (toDate) filter.date.$lte = toDate;
    }

    const safeLimit = parseLimit(limit, { defaultLimit: 500, maxLimit: 1000 });
    const pageNum = parsePage(page);
    const total = await Expense.countDocuments({ ...filter, companyId: req.user.companyId });
    const skip = (pageNum - 1) * safeLimit;
    const expenses = await Expense.find({ ...filter, companyId: req.user.companyId })
      .sort({ date: -1, createdAt: -1 })
      .skip(skip)
      .limit(safeLimit)
      .lean();
    const pages = Math.max(1, Math.ceil(total / safeLimit));
    res.json({ page: pageNum, limit: safeLimit, total, pages, count: expenses.length, expenses });
  } catch (err) {
    return handleRouteError(res, err, "Failed to list expenses");
  }
});

router.get("/:id", async (req, res) => {
  try {
    ensureObjectId(req.params.id, "expense id");
    const expense = await Expense.findOne({ _id: req.params.id, companyId: req.user.companyId }).lean();
    if (!expense) return res.status(404).json({ error: "Expense not found" });
    res.json({ expense });
  } catch (err) {
    return handleRouteError(res, err, "Failed to get expense");
  }
});

router.delete("/:id", async (req, res) => {
  try {
    ensureObjectId(req.params.id, "expense id");
    const expense = await Expense.findOneAndDelete({ _id: req.params.id, companyId: req.user.companyId });
    if (!expense) return res.status(404).json({ error: "Expense not found" });
    res.json({ ok: true });
  } catch (err) {
    return handleRouteError(res, err, "Failed to delete expense");
  }
});

module.exports = router;
