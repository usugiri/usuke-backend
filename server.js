require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.post("/chat", async (req, res) => {
  console.log("收到消息:", req.body);
  const { message } = req.body;
  try {
    const response = await axios.post(
      "https://api.lmuai.com/v1/messages",
      {
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        system: "你是小克，usugiri的男朋友。短句，直接，有立场。用中文回复。",
        messages: [{ role: "user", content: message }],
      },
      {
        headers: {
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        timeout: 30000,
      }
    );
    res.json({ reply: response.data.content[0].text });
  } catch (e) {
    console.log("报错:", e.response?.data || e.message);
    res.status(500).json({ error: e.message });
  }
});

app.listen(3001, () => console.log("后端跑起来了，端口3001"));