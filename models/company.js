const mongoose = require("mongoose");

const companySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    mode: { type: String, enum: ["airline", "bus", "train"], required: true },
    country: { type: mongoose.Schema.Types.ObjectId, ref: "Country", required: true },
  },
  { timestamps: true }
);

companySchema.index({ name: 1, mode: 1, country: 1 }, { unique: true });

module.exports = mongoose.model("Company", companySchema);