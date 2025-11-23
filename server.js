import express from "express";
import bodyParser from "body-parser";
import fetch from "node-fetch";
import fs from "fs";

const app = express();
app.use(bodyParser.json());

async function loadInventory() {
  const raw = fs.readFileSync("./inventory.json", "utf-8");
  const json = JSON.parse(raw);

  return json.inventory || [];
}

// Filter inventory and return top 3 matches
function filterVehicles(inventory, lead) {
  const priceBands = {
    "Under $20,000": [0, 20000],
    "$20k–$30k": [20000, 30000],
    "$30k–$40k": [30000, 40000],
    "$40k–$55k": [40000, 55000],
    "No preference": [0, 999999]
  };
  
  const band = priceBands[lead.price_range] || priceBands["No preference"];

  const filtered = inventory.filter(vehicle => {
    
    if (lead.body_type && lead.body_type !== "Not sure yet") {
      const leadBodyLower = lead.body_type.toLowerCase();
      const bodyMatch = vehicle.body && vehicle.body.toLowerCase().includes(leadBodyLower);
      const classMatch = vehicle.class && vehicle.class.toLowerCase().includes(leadBodyLower);

      if (!bodyMatch && !classMatch) {
        return false;
      }
    }  

    /* TODO: Uncomment when new or preowned is in the json data
    // 2) New or Used
    if (lead.new_or_used && lead.new_or_used !== "Open to anything" &&
        vehicle.new_or_used && vehicle.new_or_used !== lead.new_or_used) {
      return false;
    }
    */

    // 3) Price filter
    if (vehicle.price < band[0] || vehicle.price > band[1]) {
      return false;
    }

    // 4) Color filter (contains)
    if (lead.exterior_color && lead.exterior_color !== "Doesn’t matter") {
      if (!vehicle.color || !vehicle.color.toLowerCase().includes(lead.exterior_color.toLowerCase())) {
        return false;
      }
    }

    /* TODO: Add the following filters when the inventory.json has that as part of the structure
          Features
          Number of Seats
          Driving Style (Commuter, Work, etc...)

          Interior Color (May not be part of the current question chain in Zapier)
          Mileage (Needs to be added as part of the question chain, BUT exists on the inventory.json data already
    */

    // TODO: Had to remove EV/Hybrid for now as that style was in the name of the vehicle.  Need to add a new question or update JSON

    return true; // matches all criteria
  });

  // Return top 3 matches
  return filtered.slice(0, 3);
}

app.post("/match", async (req, res) => {
  try {
    const lead = req.body;
    const inventory = await loadInventory();

    const matches = filterVehicles(inventory, lead);
    
    res.json({ matches: matches });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Match failed" });
  }
});

app.get("/", (_, res) => res.send("OK"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server listening on " + PORT));
