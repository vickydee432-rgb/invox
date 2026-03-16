const Invoice = require("../models/Invoice");
const Expense = require("../models/Expense");

/**
 * Generate VAT Return (Form VAT 100 Equivalent)
 * Standard Rate: 16%
 */
async function generateVatReturn(companyId, fromDate, toDate) {
  const match = {
    companyId,
    issueDate: { $gte: new Date(fromDate), $lte: new Date(toDate) },
    deletedAt: null
  };

  // 1. Output VAT (Sales)
  const sales = await Invoice.aggregate([
    { $match: { ...match, invoiceType: { $ne: "purchase" } } },
    { $group: { 
        _id: null, 
        taxableValue: { $sum: "$subtotal" },
        vatAmount: { $sum: "$vatAmount" },
        totalSales: { $sum: "$total" }
    }}
  ]);

  // 2. Input VAT (Purchases/Expenses)
  // Assumes expenses/purchases track VAT separately
  const expenses = await Expense.aggregate([
    { $match: { companyId, date: { $gte: new Date(fromDate), $lte: new Date(toDate) }, deletedAt: null } },
    { $group: { 
        _id: null, 
        totalAmount: { $sum: "$amount" },
        vatAmount: { $sum: "$vatAmount" } // Assuming expense model has this
    }}
  ]);

  const outputVat = sales[0]?.vatAmount || 0;
  const inputVat = expenses[0]?.vatAmount || 0;
  const vatPayable = outputVat - inputVat;

  return {
    period: { from: fromDate, to: toDate },
    currency: "ZMW",
    outputs: {
      standardRatedSales: sales[0]?.taxableValue || 0,
      outputVat: outputVat
    },
    inputs: {
      standardRatedPurchases: expenses[0]?.totalAmount || 0, // Simplified for example
      inputVat: inputVat
    },
    netVatPayable: vatPayable,
    status: vatPayable > 0 ? "PAYABLE" : "REFUNDABLE"
  };
}

/**
 * Generate Turnover Tax Return (TOT)
 * Rate: 4% on gross monthly turnover
 */
async function generateTurnoverTax(companyId, fromDate, toDate) {
  const match = {
    companyId,
    issueDate: { $gte: new Date(fromDate), $lte: new Date(toDate) },
    invoiceType: { $ne: "purchase" },
    deletedAt: null
  };

  const sales = await Invoice.aggregate([
    { $match: match },
    { $group: { _id: null, grossTurnover: { $sum: "$total" } } }
  ]);

  const grossTurnover = sales[0]?.grossTurnover || 0;
  const taxRate = 0.04; // 4%
  const taxDue = grossTurnover * taxRate;

  return {
    period: { from: fromDate, to: toDate },
    currency: "ZMW",
    grossTurnover,
    taxRate: "4%",
    taxDue
  };
}

module.exports = { generateVatReturn, generateTurnoverTax };