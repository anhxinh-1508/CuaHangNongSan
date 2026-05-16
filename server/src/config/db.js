const dns = require("dns");
const mongoose = require("mongoose");
const env = require("./env");

/** Render/cloud DNS ổn với SRV; Windows + ISP (Viettel…) đôi khi Node bị querySrv ECONNREFUSED. */
function configureDnsForMongo() {
  if (typeof dns.setDefaultResultOrder === "function") {
    dns.setDefaultResultOrder("ipv4first");
  }
  if (typeof dns.setServers !== "function") return;
  const custom = (process.env.DNS_SERVERS || "").trim();
  if (custom) {
    dns.setServers(custom.split(",").map((s) => s.trim()).filter(Boolean));
    return;
  }
  const uri = env.mongoUri || "";
  if (uri.startsWith("mongodb+srv://")) {
    dns.setServers(["8.8.8.8", "8.8.4.4", "1.1.1.1"]);
  }
}

async function connectDb() {
  if (!env.mongoUri) {
    throw new Error("MONGODB_URI is required");
  }
  configureDnsForMongo();
  await mongoose.connect(env.mongoUri, {
    serverSelectionTimeoutMS: 20000,
    family: 4,
  });
}

module.exports = { connectDb };
