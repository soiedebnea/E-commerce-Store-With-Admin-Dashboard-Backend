const mongoose = require("mongoose");

const countrySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    code: { type: String, required: true, uppercase: true, trim: true },
    flag: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Country", countrySchema);