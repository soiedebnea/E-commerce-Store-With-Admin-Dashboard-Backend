require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const User = require("../models/User");
const Product = require("../models/Product");
const Country = require("../models/Country");
const Company = require("../models/Company");

const products = [
  { name: "Wireless Bluetooth Headphones", category: "Electronics", price: 59.99, stock: 120, brand: "SoundCore", description: "Over-ear wireless headphones with active noise cancellation and 30-hour battery life.", imageUrl: "" },
  { name: "Smartphone 128GB", category: "Electronics", price: 399.0, stock: 45, brand: "Nova", description: "6.5-inch display, 128GB storage, triple camera setup.", imageUrl: "" },
  { name: "Stainless Steel Water Bottle", category: "Home & Kitchen", price: 15.5, stock: 300, brand: "HydroFlow", description: "Double-wall insulated bottle, keeps drinks cold for 24 hours.", imageUrl: "" },
  { name: "Men's Running Shoes", category: "Fashion", price: 74.99, stock: 80, brand: "Stride", description: "Lightweight breathable running shoes with cushioned sole.", imageUrl: "" },
  { name: "Women's Leather Handbag", category: "Fashion", price: 89.0, stock: 60, brand: "Aria", description: "Genuine leather handbag with adjustable strap.", imageUrl: "" },
  { name: "4-Slice Toaster", category: "Home & Kitchen", price: 34.99, stock: 90, brand: "KitchenPro", description: "Stainless steel toaster with 6 browning settings.", imageUrl: "" },
  { name: "Yoga Mat", category: "Sports & Outdoors", price: 22.0, stock: 150, brand: "FlexFit", description: "Non-slip eco-friendly yoga mat, 6mm thick.", imageUrl: "" },
  { name: "Mechanical Gaming Keyboard", category: "Electronics", price: 68.5, stock: 70, brand: "KeyForge", description: "RGB backlit mechanical keyboard with blue switches.", imageUrl: "" },
  { name: "Children's Story Book Set", category: "Books", price: 19.99, stock: 200, brand: "TalePress", description: "Set of 5 illustrated story books for kids ages 4-8.", imageUrl: "" },
  { name: "Ceramic Cookware Set", category: "Home & Kitchen", price: 129.0, stock: 35, brand: "ChefLine", description: "10-piece non-stick ceramic cookware set.", imageUrl: "" },
  { name: "Electric Kettle 1.7L", category: "Home & Kitchen", price: 27.99, stock: 110, brand: "HeatFast", description: "Rapid boil electric kettle with auto shut-off.", imageUrl: "" },
  { name: "Backpack 30L", category: "Sports & Outdoors", price: 45.0, stock: 95, brand: "TrailPack", description: "Water-resistant travel backpack with laptop compartment.", imageUrl: "" },
];


// ---------------------------------------------------------------------------
// Travel data: real operator names per country. Routes, times and prices below
// are SAMPLE data generated for demo purposes - edit them from the admin panel.
// ---------------------------------------------------------------------------
const countries = [
  { name: "Bangladesh", code: "BD", flag: "🇧🇩", cities: ["Dhaka", "Chittagong", "Sylhet", "Cox's Bazar"],
    airline: ["Biman Bangladesh Airlines", "US-Bangla Airlines", "NovoAir"],
    bus: ["Hanif Paribahan", "Shohagh Paribahan", "Green Line Paribahan"],
    train: ["Bangladesh Railway"] },
  { name: "India", code: "IN", flag: "🇮🇳", cities: ["Delhi", "Mumbai", "Kolkata", "Bangalore"],
    airline: ["IndiGo", "Air India", "SpiceJet"],
    bus: ["VRL Travels", "KSRTC", "Orange Travels"],
    train: ["Indian Railways"] },
  { name: "United States", code: "US", flag: "🇺🇸", cities: ["New York", "Washington DC", "Chicago", "Los Angeles"],
    airline: ["American Airlines", "Delta Air Lines", "United Airlines"],
    bus: ["Greyhound", "Megabus"],
    train: ["Amtrak"] },
  { name: "United Kingdom", code: "GB", flag: "🇬🇧", cities: ["London", "Manchester", "Edinburgh", "Birmingham"],
    airline: ["British Airways", "easyJet"],
    bus: ["National Express", "Megabus"],
    train: ["Great Western Railway", "LNER"] },
  { name: "United Arab Emirates", code: "AE", flag: "🇦🇪", cities: ["Dubai", "Abu Dhabi", "Sharjah", "Ras Al Khaimah"],
    airline: ["Emirates", "Etihad Airways", "Air Arabia"],
    bus: ["Emirates Transport", "RTA Intercity Bus"],
    train: [] },
  { name: "Germany", code: "DE", flag: "🇩🇪", cities: ["Berlin", "Munich", "Hamburg", "Frankfurt"],
    airline: ["Lufthansa", "Eurowings"],
    bus: ["FlixBus"],
    train: ["Deutsche Bahn"] },
  { name: "Canada", code: "CA", flag: "🇨🇦", cities: ["Toronto", "Montreal", "Ottawa", "Calgary"],
    airline: ["Air Canada", "WestJet"],
    bus: ["Ontario Northland", "Rider Express"],
    train: ["VIA Rail"] },
  { name: "Australia", code: "AU", flag: "🇦🇺", cities: ["Sydney", "Melbourne", "Brisbane", "Canberra"],
    airline: ["Qantas", "Virgin Australia", "Jetstar"],
    bus: ["Greyhound Australia", "Firefly Express"],
    train: ["NSW TrainLink"] },
];

const MODE = {
  airline: { base: 85, step: 18, seats: 60, cls: ["Economy", "Business"], times: [["07:00", "09:10"], ["13:30", "15:45"], ["19:15", "21:20"]] },
  bus:     { base: 14, step: 4,  seats: 40, cls: ["AC", "Non-AC"],         times: [["06:30", "12:30"], ["14:00", "20:15"], ["22:00", "05:00"]] },
  train:   { base: 18, step: 5,  seats: 80, cls: ["Standard", "First Class"], times: [["08:00", "13:00"], ["11:30", "17:10"], ["20:00", "03:00"]] },
};

const buildTravel = async () => {
  let ticketCount = 0;
  for (const c of countries) {
    const country = await Country.create({ name: c.name, code: c.code, flag: c.flag });
    for (const mode of ["airline", "bus", "train"]) {
      for (const companyName of c[mode]) {
        const company = await Company.create({ name: companyName, mode, country: country._id });
        const m = MODE[mode];
        const tickets = [];
        for (let r = 0; r < 3; r++) {
          const from = c.cities[r % c.cities.length];
          const to = c.cities[(r + 1 + (r > 1 ? 1 : 0)) % c.cities.length];
          const [dep, arr] = m.times[r];
          const cls = m.cls[r % m.cls.length];
          tickets.push({
            kind: "ticket",
            name: `${companyName}: ${from} to ${to}`,
            category: "Ticket",
            description: `${mode} ticket from ${from} to ${to} with ${companyName}.`,
            brand: companyName,
            price: m.base + m.step * r + (cls === "Business" || cls === "First Class" ? m.step * 2 : 0),
            stock: m.seats,
            country: country._id,
            company: company._id,
            mode, from, to,
            departureTime: dep, arrivalTime: arr, travelClass: cls,
          });
        }
        await Product.insertMany(tickets);
        ticketCount += tickets.length;
      }
    }
  }
  return ticketCount;
};

const seed = async () => {
  await connectDB();

  await User.deleteMany({ email: "admin@example.com" });
  await Product.deleteMany({});
  await Country.deleteMany({});
  await Company.deleteMany({});

  await User.create({
    name: "Store Admin",
    email: "admin@example.com",
    password: "Admin@123",
    role: "admin",
  });

  await Product.insertMany(products);

  console.log("Seed complete.");
  console.log("Admin login -> email: admin@example.com | password: Admin@123");
  console.log(`Inserted ${products.length} products.`);
  const t = await buildTravel();
  console.log(`Inserted ${countries.length} countries and ${t} sample tickets.`);

  await mongoose.connection.close();
  process.exit(0);
};

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});