require("dotenv").config();

const express = require("express");
const { Client, GatewayIntentBits } = require("discord.js");
const sqlite3 = require("sqlite3").verbose();
const { v4: uuidv4 } = require("uuid");

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
    res.send("API online");
});

const db = new sqlite3.Database("./keys.db");

db.run(`
CREATE TABLE IF NOT EXISTS keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT,
    discord_id TEXT,
    expires TEXT
)
`);

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

        db.run(
            "INSERT INTO keys (key, discord_id, expires) VALUES (?, ?, ?)",
            [
                key,
                message.author.id,
                expires.toISOString()
            ]
        );

        message.reply(
            `🔑 Sua key:\n${key}\n\n⏰ Expira em 30 dias`
        );
    }
});

app.post("/verify", (req, res) => {

    const { key } = req.body;

    db.get(
        "SELECT * FROM keys WHERE key = ?",
        [key],
        (err, row) => {

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
        }
    );
});

client.login(process.env.TOKEN);

app.listen(3000, () => {
    console.log("API rodando na porta 3000");
});