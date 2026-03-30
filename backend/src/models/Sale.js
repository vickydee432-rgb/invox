const mongoose = require("mongoose");

const SaleItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    productSku: { type: String, trim: true },
    productName: { type: String, trim: true },
    phoneItemId: { type: mongoose.Schema.Types.ObjectId, ref: "PhoneInventoryItem" },
    phoneImei: { type: String, trim: true },
    phoneSerial: { type: String, trim: true },
    description: { type: String, required: true, trim: true },
    qty: { type: Number, required: true, min: 0 },
    unitPrice: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    lineTotal: { type: Number, required: true, min: 0 }
  },
  { _id: false }
);

const SaleSchema = new mongoose.Schema(
  {
    saleNo: { type: String, required: true, index: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    workspaceId: { type: String, trim: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    deviceId: { type: String, trim: true, index: true },

    receiptInvoiceId: { type: mongoose.Schema.Types.ObjectId, ref: "Invoice", default: null, index: true },

    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", default: null, index: true },
    customerName: { type: String, trim: true, default: "Walk-in" },
    customerPhone: { type: String, trim: true },
    customerTpin: { type: String, trim: true },

    salespersonId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    tradeInId: { type: mongoose.Schema.Types.ObjectId, ref: "TradeIn", default: null, index: true },
    tradeInCredit: { type: Number, default: 0, min: 0 },

    branchId: { type: mongoose.Schema.Types.ObjectId, ref: "Branch", default: null, index: true },
    branchName: { type: String, trim: true },

    status: {
      type: String,
      enum: ["paid", "partial", "unpaid", "cancelled"],
      default: "paid",
      index: true
    },

    source: { type: String, enum: ["APP", "ZRA"], default: "APP", index: true },
    issueDate: { type: Date, default: () => new Date() },

    items: { type: [SaleItemSchema], default: [] },

    subtotal: { type: Number, required: true, min: 0 },
    vatRate: { type: Number, default: 0, min: 0 },
    vatAmount: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },

    amountPaid: { type: Number, default: 0, min: 0 },
    balance: { type: Number, default: 0, min: 0 },

    version: { type: Number, default: 1 },
    deletedAt: { type: Date }
  },
  { timestamps: true }
);

SaleSchema.index({ companyId: 1, saleNo: 1 }, { unique: true });
SaleSchema.index({ companyId: 1, issueDate: -1 });
SaleSchema.index({ companyId: 1, customerId: 1, issueDate: -1 });
SaleSchema.index({ companyId: 1, salespersonId: 1, issueDate: -1 });
SaleSchema.index({ companyId: 1, tradeInId: 1, issueDate: -1 });

module.exports = mongoose.model("Sale", SaleSchema);
