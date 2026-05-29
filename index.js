require("dotenv").config();

const express = require("express");
const { Client, GatewayIntentBits } = require("discord.js");
const { Low } = require("lowdb");
const { JSONFile } = require("lowdb/node");
const { v4: uuidv4 } = require("uuid");

const app = express();

app.use(express.json());

/* ---------------- DATABASE ---------------- */

const adapter = new JSONFile("db.json");

const db = new Low(adapter, {
    keys: []
});

async function initDB() {
    await db.read();

    db.data ||= {
        keys: []
    };

    await db.write();
}

/* ---------------- HELPERS ---------------- */

function getKey(key) {
    return db.data.keys.find(k => k.key === key);
}

function getUserKey(userId) {
    return db.data.keys.find(k => k.discord_id === userId);
}

async function saveDB() {
    await db.write();
}

/* ---------------- DISCORD BOT ---------------- */

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

/* CANAL */
const CHANNEL_ALLOWED = "1509913554692735016";

/* CARGOS */
const ROLE_7D = "1509913837661458594";
const ROLE_30D = "1509913884868477039";
const ROLE_PERM = "1509913892703305748";

client.on("ready", () => {
    console.log(`Bot online: ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {

    if (message.author.bot) return;

    if (message.content !== "!key") return;

    if (message.channel.id !== CHANNEL_ALLOWED) return;

    const member = message.member;

    if (!member) return;

    let plan = null;
    let days = 0;

    if (member.roles.cache.has(ROLE_PERM)) {
        plan = "permanent";
        days = 3650;
    }
    else if (member.roles.cache.has(ROLE_30D)) {
        plan = "30d";
        days = 30;
    }
    else if (member.roles.cache.has(ROLE_7D)) {
        plan = "7d";
        days = 7;
    }
    else {
        return message.reply("❌ Você não tem cargo para gerar key.");
    }


    const key = uuidv4();

    const expires = new Date();

    expires.setDate(expires.getDate() + days);

    db.data.keys.push({
        key,
        discord_id: message.author.id,
        hwid: null,
        plan,
        expires: expires.toISOString(),
        revoked: false
    });

    await saveDB();

    message.reply(
`🔑 Sua key:
\`${key}\`

📦 Plano: ${plan}
⏰ Expira em ${days} dias`
    );
});

/* ---------------- API VERIFY ---------------- */

app.post("/verify", async (req, res) => {

    /* ---------------- ADMIN ---------------- */

app.get("/keys", (req, res) => {

    res.json(db.data.keys);
});

app.post("/revoke", async (req, res) => {

    const { key } = req.body;

    const found =
        db.data.keys.find(k => k.key === key);

    if (!found) {

        return res.json({
            success: false,
            reason: "not_found"
        });
    }

    found.revoked = true;

    await db.write();

    res.json({
        success: true
    });
});

app.post("/unrevoke", async (req, res) => {

    const { key } = req.body;

    const found =
        db.data.keys.find(k => k.key === key);

    if (!found) {

        return res.json({
            success: false,
            reason: "not_found"
        });
    }

    found.revoked = false;

    await db.write();

    res.json({
        success: true
    });
});

    const { key, hwid } = req.body;

    if (!key || !hwid) {
        return res.json({
            valid: false,
            reason: "missing_fields"
        });
    }

    const data = getKey(key);

    if (!data) {
        return res.json({
            valid: false,
            reason: "invalid"
        });
    }

    if (data.revoked) {
        return res.json({
            valid: false,
            reason: "revoked"
        });
    }

    if (
        data.expires &&
        new Date(data.expires) < new Date()
    ) {
        return res.json({
            valid: false,
            reason: "expired"
        });
    }

    /* primeiro login salva HWID */
    if (!data.hwid) {

        data.hwid = hwid;

        await saveDB();
    }

    /* outro PC */
    if (data.hwid !== hwid) {

        return res.json({
            valid: false,
            reason: "hwid_mismatch"
        });
    }

    return res.json({
        valid: true,
        discord_id: data.discord_id,
        plan: data.plan,
        expires: data.expires
    });
});

/* ---------------- START ---------------- */

async function start() {

    await initDB();

    client.login(process.env.TOKEN);

    const PORT = process.env.PORT || 3000;

    app.listen(PORT, () => {
        console.log(`API rodando na porta ${PORT}`);
    });
}

start();