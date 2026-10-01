require("dotenv").config();
const express = require("express");
const fetch = require("node-fetch");
const { SocksProxyAgent } = require("socks-proxy-agent");

const app = express();
const PORT = process.env.PORT || 3000;
const STOCK_URL = "https://api.courtyard.io/vending-machines/mtg-sealed-booster/stock";

let previousState = "UNKNOWN";

function getBangladeshTime() {
  return new Date().toLocaleString("en-US", {
    timeZone: "Asia/Dhaka",
    dateStyle: "medium",
    timeStyle: "medium",
  });
}

async function sendTelegram(message) {
  const url = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: process.env.TELEGRAM_CHAT_ID,
      text: message,
      disable_web_page_preview: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Telegram error: ${errorText}`);
  }
}

async function checkStock() {
  try {
    let agent = null;
    if (process.env.SOCKS5_PROXY) {
      agent = new SocksProxyAgent(process.env.SOCKS5_PROXY);
    }

    const response = await fetch(STOCK_URL, {
      agent: agent,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
        "Cache-Control": "no-cache",
      },
    });

    if (!response.ok) {
      throw new Error(`Stock API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`[${getBangladeshTime()}] Checked Stock: outOfStock=${data.outOfStock}, lowStock=${data.lowStock}`);

    const inStock = data.outOfStock === false;

    if (inStock) {
      if (previousState !== "IN_STOCK") {
        const time = getBangladeshTime();
        await sendTelegram(
          `🚨 MTG SEALED BOOSTER IN STOCK!\n\n✅ outOfStock: ${data.outOfStock}\n📦 lowStock: ${data.lowStock}\n\n🕐 Time: ${time}\n🇧🇩 Bangladesh Time\n\n🔥 STOCK AVAILABLE NOW`
        );
        previousState = "IN_STOCK";
        console.log("✅ Telegram notification sent");
      }
    } else {
      if (previousState !== "OUT_OF_STOCK") {
        previousState = "OUT_OF_STOCK";
        console.log("Stock state reset to OUT_OF_STOCK");
      }
    }
  } catch (error) {
    console.error(`[${getBangladeshTime()}] Error checking stock:`, error.message);
  }
}

// Check every 10 seconds automatically
setInterval(checkStock, 10 * 1000);

// Basic HTTP server to keep Render happy and allow manual checks
app.get("/", (req, res) => {
  res.send(`Courtyard Stock Checker is running. Current state: ${previousState}. Time: ${getBangladeshTime()}`);
});

app.get("/check", async (req, res) => {
  await checkStock();
  res.send(`Check triggered. Time: ${getBangladeshTime()}`);
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  // Do an initial check immediately
  checkStock();
});
