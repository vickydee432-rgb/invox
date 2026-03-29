const mongoose = require("mongoose");

const RepairJobSchema = new mongoose.Schema(
  {
    jobNo: { type: String, required: true, index: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    workspaceId: { type: String, trim: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    deviceId: { type: String, trim: true, index: true },

    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", default: null, index: true },
    customerName: { type: String, trim: true },
    customerPhone: { type: String, trim: true },

    deviceBrand: { type: String, trim: true },
    deviceModel: { type: String, trim: true },
    imei: { type: String, trim: true, index: true },
    serial: { type: String, trim: true, index: true },
    storage: { type: String, trim: true },
    color: { type: String, trim: true },
    condition: { type: String, trim: true },

    issueDescription: { type: String, required: true, trim: true },

    technicianId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },

    status: {
      type: String,
      enum: ["pending", "assigned", "in_progress", "waiting_parts", "completed", "cancelled"],
      default: "pending",
      index: true
    },

    laborCharge: { type: Number, default: 0, min: 0 },
    partsCharge: { type: Number, default: 0, min: 0 },
    totalCharge: { type: Number, default: 0, min: 0 },

    amountPaid: { type: Number, default: 0, min: 0 },
    balance: { type: Number, default: 0, min: 0 },

    receivedAt: { type: Date, default: () => new Date(), index: true },
    completedAt: { type: Date },

    notes: { type: String, trim: true },

    version: { type: Number, default: 1 },
    deletedAt: { type: Date }
  },
  { timestamps: true }
);

RepairJobSchema.index({ companyId: 1, jobNo: 1 }, { unique: true });
RepairJobSchema.index({ companyId: 1, receivedAt: -1 });

module.exports = mongoose.model("RepairJob", RepairJobSchema);

