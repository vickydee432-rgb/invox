const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, unique: true, lowercase: true, index: true },
    passwordHash: { type: String, required: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    resetTokenHash: { type: String, index: true },
    resetTokenExpires: { type: Date }
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", UserSchema);
