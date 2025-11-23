import express from "express";
import bodyParser from "body-parser";
import fetch from "node-fetch";

const app = express();
app.use(bodyParser.json());

const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

// Load inventory from Google Sheets "inventory" tab
async function loadInventory() {
  const range = "inventory!A2:R999";
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}/values/${encodeURIComponent(range)}?key=${GOOGLE_API_KEY}`;

  const res = await fetch(url);
  const json = await res.json();
  const rows = json.values || [];

  const headers = [
    "id","vin","year","make","model","trim","price","mileage","condition",
    "body_type","exterior_color","drivetrain","seats","priority_tags",
    "features","photo_url","link_url","kia_360_url"
  ];

  return rows.map(r => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = r[i]);
    obj.price = Number(obj.price || 0);
    obj.mileage = Number(obj.mileage || 0);
    obj.seats = Number(obj.seats || 0);
    return obj;
  });
}

import fs from "fs";
async function testLoadInventory() {
  const raw = fs.readFileSync("./inventory.json", "utf-8");
  const json = JSON.parse(raw);

  return json.inventory;
}

// Basic scoring logic
function scoreVehicle(vehicle, lead) {
  let score = 0;

  // Hard filter: body type (unless customer said "Not sure yet")
  if (lead.body_type && lead.body_type !== "Not sure yet" &&
      vehicle.body_type && vehicle.body_type !== lead.body_type) {
    return -1;
  }

  // Budget band
  const priceBands = {
    "Under $20,000": [0, 20000],
    "$20k–$30k": [20000, 30000],
    "$30k–$40k": [30000, 40000],
    "$40k–$55k": [40000, 55000],
    "No preference": [0, 999999]
  };
  const band = priceBands[lead.price_range] || priceBands["No preference"];
  if (vehicle.price < band[0] - 2000 || vehicle.price > band[1] + 2000) {
    return -1;
  }

  // 1) Price closeness
  const target = (band[0] + band[1]) / 2 || vehicle.price || 30000;
  const priceDiff = Math.abs(vehicle.price - target);
  const priceScore = Math.max(0, 1 - priceDiff / target); // 0–1
  score += priceScore * 30;

  // 2) Priority tags overlap (e.g. "safety, tech, space")
  const leadTags = (lead.priority_features || "").toLowerCase().split(",");
  const vTags = (vehicle.priority_tags || "").toLowerCase().split(",");
  const overlap = vTags.filter(t => leadTags.includes(t.trim()) && t.trim() !== "");
  const tagScore = overlap.length / Math.max(1, leadTags.length);
  score += tagScore * 25;

  // 3) Mileage (lower is better for used)
  const milesScore = Math.max(0, 1 - vehicle.mileage / 150000);
  score += milesScore * 15;

  // 4) Condition preference
  if (lead.condition_pref && lead.condition_pref !== "Open to anything") {
    score += (vehicle.condition === lead.condition_pref ? 1 : 0) * 10;
  }

  // 5) Color match
  if (lead.exterior_color && lead.exterior_color !== "Doesn’t matter") {
    score += (vehicle.exterior_color === lead.exterior_color ? 1 : 0) * 10;
  }

  return score;
}

app.post("/match", async (req, res) => {
  try {
    const lead = req.body.lead;
    //const inventory = await loadInventory();
    const inventory = await testLoadInventory();

    const scored = inventory//inventory
      //.map(v => ({ v, s: scoreVehicle(v, lead) }))
      //.filter(x => x.s >= 0)
      //.sort((a, b) => b.s - a.s)
      //.slice(0, 3)
     // .map(x => x.v);

    res.json({ matches: scored });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Match failed" });
  }
});

app.get("/", (_, res) => res.send("OK"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server listening on " + PORT));
