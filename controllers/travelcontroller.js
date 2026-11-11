const Country = require("../models/Country");
const Company = require("../models/Company");

// GET /api/travel/countries
exports.getCountries = async (req, res, next) => {
  try {
    res.json(await Country.find().sort({ name: 1 }));
  } catch (err) { next(err); }
};

// GET /api/travel/companies?country=<id>&mode=airline|bus|train
exports.getCompanies = async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.country) filter.country = req.query.country;
    if (req.query.mode) filter.mode = req.query.mode;
    res.json(await Company.find(filter).sort({ name: 1 }));
  } catch (err) { next(err); }
};

// POST /api/travel/countries (admin)
exports.createCountry = async (req, res, next) => {
  try { res.status(201).json(await Country.create(req.body)); } catch (err) { next(err); }
};

// POST /api/travel/companies (admin)
exports.createCompany = async (req, res, next) => {
  try { res.status(201).json(await Company.create(req.body)); } catch (err) { next(err); }
};