require("dotenv").config();

const express = require("express");
const { Client, GatewayIntentBits } = require("discord.js");
const Database = require("better-sqlite3");
const { v4: uuidv4 } = require("uuid");

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
    res.send("API online");
});

const db = new Database("./keys.db");

db.prepare(`
CREATE TABLE IF NOT EXISTS keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT,
    discord_id TEXT,
    expires TEXT
)
`).run();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.on("ready", () => {
    console.log(`Bot online: ${client.user.tag}`);
});

client.on("messageCreate", (message) => {

    if (message.author.bot) return;

    if (message.content === "!key") {

        const key = uuidv4();

        const expires = new Date();
        expires.setDate(expires.getDate() + 30);

        db.prepare(`
            INSERT INTO keys (key, discord_id, expires)
            VALUES (?, ?, ?)
        `).run(
            key,
            message.author.id,
            expires.toISOString()
        );

        message.reply(
            `🔑 Sua key:\n${key}\n\n⏰ Expira em 30 dias`
        );
    }
});

app.post("/verify", (req, res) => {

    const { key } = req.body;

    const row = db
        .prepare("SELECT * FROM keys WHERE key = ?")
        .get(key);

    if (!row) {
        return res.json({
            valid: false,
            reason: "invalid_key"
        });
    }

    const now = new Date();
    const expires = new Date(row.expires);

    if (now > expires) {
        return res.json({
            valid: false,
            reason: "expired"
        });
    }

    res.json({
        valid: true,
        discord_id: row.discord_id,
        expires: row.expires
    });
});

client.login(process.env.TOKEN);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`API rodando na porta ${PORT}`);
});