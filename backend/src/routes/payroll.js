const express = require("express");
const { z } = require("zod");
const Employee = require("../models/Employee");
const SalaryStructure = require("../models/SalaryStructure");
const Payrun = require("../models/Payrun");
const Payslip = require("../models/Payslip");
const Company = require("../models/Company");
const { requireAuth } = require("../middleware/auth");
const { requireSubscription } = require("../middleware/subscription");
const { requireModule } = require("../middleware/workspace");
const { ensureObjectId, handleRouteError } = require("./_helpers");
const { postPayroll } = require("../services/ledger");

const router = express.Router();
router.use(requireAuth, requireSubscription, requireModule("payroll"));

const EmployeeSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  idNumber: z.string().optional(),
  taxNumber: z.string().optional(),
  department: z.string().optional(),
  status: z.enum(["active", "inactive"]).optional()
});

router.get("/employees", async (req, res) => {
  try {
    const employees = await Employee.find({ companyId: req.user.companyId }).sort({ lastName: 1 }).lean();
    res.json({ employees });
  } catch (err) {
    return handleRouteError(res, err, "Failed to load employees");
  }
});

router.post("/employees", async (req, res) => {
  try {
    const parsed = EmployeeSchema.parse(req.body);
    const employee = await Employee.create({ companyId: req.user.companyId, ...parsed });
    res.status(201).json({ employee });
  } catch (err) {
    return handleRouteError(res, err, "Failed to create employee");
  }
});

const SalarySchema = z.object({
  employeeId: z.string().min(1),
  baseSalary: z.number().nonnegative(),
  allowances: z.array(z.object({ name: z.string(), amount: z.number().nonnegative() })).optional(),
  deductions: z.array(z.object({ name: z.string(), amount: z.number().nonnegative() })).optional()
});

router.get("/salary-structures", async (req, res) => {
  try {
    const structures = await SalaryStructure.find({ companyId: req.user.companyId }).lean();
    res.json({ structures });
  } catch (err) {
    return handleRouteError(res, err, "Failed to load salary structures");
  }
});

router.post("/salary-structures", async (req, res) => {
  try {
    const parsed = SalarySchema.parse(req.body);
    ensureObjectId(parsed.employeeId, "employee id");
    const structure = await SalaryStructure.findOneAndUpdate(
      { companyId: req.user.companyId, employeeId: parsed.employeeId },
      {
        companyId: req.user.companyId,
        employeeId: parsed.employeeId,
        baseSalary: parsed.baseSalary,
        allowances: parsed.allowances || [],
        deductions: parsed.deductions || []
      },
      { upsert: true, new: true }
    );
    res.status(201).json({ structure });
  } catch (err) {
    return handleRouteError(res, err, "Failed to save salary structure");
  }
});

const PayrunSchema = z.object({
  period: z.string().min(1),
  employeeIds: z.array(z.string()).optional()
});

router.post("/payruns/generate", async (req, res) => {
  try {
    const parsed = PayrunSchema.parse(req.body);
    const company = await Company.findById(req.user.companyId).lean();
    if (!company) return res.status(404).json({ error: "Company not found" });

    const filter = { companyId: req.user.companyId, status: "active" };
    if (parsed.employeeIds?.length) {
      parsed.employeeIds.forEach((id) => ensureObjectId(id, "employee id"));
      filter._id = { $in: parsed.employeeIds };
    }

    const employees = await Employee.find(filter).lean();
    const structures = await SalaryStructure.find({ companyId: req.user.companyId }).lean();
    const structureMap = new Map(structures.map((s) => [String(s.employeeId), s]));

    const payrun = await Payrun.create({
      companyId: req.user.companyId,
      period: parsed.period,
      status: "processed"
    });

    const payeRate = Number(company.payrollConfig?.payeRate || 0);
    const napsaRate = Number(company.payrollConfig?.napsaRate || 0);
    const nimaRate = Number(company.payrollConfig?.nimaRate || 0);

    let totals = { gross: 0, paye: 0, napsa: 0, nima: 0, net: 0 };
    const slips = employees.map((employee) => {
      const structure = structureMap.get(String(employee._id));
      const base = Number(structure?.baseSalary || 0);
      const allowances = structure?.allowances || [];
      const deductions = structure?.deductions || [];
      const allowanceTotal = allowances.reduce((sum, item) => sum + Number(item.amount || 0), 0);
      const deductionTotal = deductions.reduce((sum, item) => sum + Number(item.amount || 0), 0);
      const gross = Math.max(0, base + allowanceTotal - deductionTotal);
      const paye = Math.max(0, gross * payeRate);
      const napsa = Math.max(0, gross * napsaRate);
      const nima = Math.max(0, gross * nimaRate);
      const net = Math.max(0, gross - paye - napsa - nima);
      totals = {
        gross: totals.gross + gross,
        paye: totals.paye + paye,
        napsa: totals.napsa + napsa,
        nima: totals.nima + nima,
        net: totals.net + net
      };
      return {
        companyId: req.user.companyId,
        payrunId: payrun._id,
        employeeId: employee._id,
        gross,
        net,
        taxes: [
          { name: "PAYE", amount: paye },
          { name: "NAPSA", amount: napsa },
          { name: "NIMA", amount: nima }
        ],
        deductions,
        allowances
      };
    });

    if (slips.length > 0) {
      await Payslip.insertMany(slips);
    }

    try {
      await postPayroll({ companyId: req.user.companyId, payrun, totals });
    } catch (err) {
      console.warn("Ledger posting failed for payroll", err);
    }

    res.status(201).json({ payrun, count: slips.length, totals });
  } catch (err) {
    return handleRouteError(res, err, "Failed to generate payrun");
  }
});

router.get("/payslips/:id", async (req, res) => {
  try {
    ensureObjectId(req.params.id, "payslip id");
    const payslip = await Payslip.findOne({ _id: req.params.id, companyId: req.user.companyId }).lean();
    if (!payslip) return res.status(404).json({ error: "Payslip not found" });
    res.json({ payslip });
  } catch (err) {
    return handleRouteError(res, err, "Failed to load payslip");
  }
});

module.exports = router;
