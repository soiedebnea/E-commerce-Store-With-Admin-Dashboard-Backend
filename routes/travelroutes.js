const express = require("express");
const router = express.Router();
const { getCountries, getCompanies, createCountry, createCompany } = require("../controllers/travelController");
const { protect, adminOnly } = require("../middleware/auth");

router.get("/countries", getCountries);
router.get("/companies", getCompanies);
router.post("/countries", protect, adminOnly, createCountry);
router.post("/companies", protect, adminOnly, createCompany);

module.exports = router;