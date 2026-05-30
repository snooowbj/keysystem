require("dotenv").config();

const express = require("express");
const { Client, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const { v4: uuidv4 } = require("uuid");

const { Low } = require("lowdb");
const { JSONFile } = require("lowdb/node");

const app = express();

app.use(express.json());

/* ===================================================== */
/* DATABASE */
/* ===================================================== */

const adapter = new JSONFile("./db.json");

const db = new Low(adapter, {
    keys: [],
    staff: {}
});

/* ===================================================== */
/* CONFIG */
/* ===================================================== */

const TOKEN = process.env.TOKEN;

const PORT = process.env.PORT || 3000;

const CHANNEL_KEY = "1509913554692735016";

const OWNER_IDS = [
    "933025502095102012",
    "1504981387294281768"
];

/* ROLES */

const ROLE_7D = "1509913837661458594";
const ROLE_30D = "1509913884868477039";
const ROLE_INF = "1509913892703305748";

/* ===================================================== */
/* HELPERS */
/* ===================================================== */

function getLevel(userId) {

    if (OWNER_IDS.includes(userId)) {
        return 3;
    }

    return db.data.staff[userId] || 0;
}

function setLevel(userId, level) {

    db.data.staff[userId] = level;
}

function parseDuration(input) {

    if (!input) return null;

    input = input.toLowerCase();

    if (input === "inf") {

        return {
            infinite: true,
            ms: null
        };
    }

    const match =
        input.match(/^(\d+)([dhm])$/);

    if (!match) return null;

    const value = Number(match[1]);

    const unit = match[2];

    let ms = 0;

    if (unit === "d") {
        ms = value * 24 * 60 * 60 * 1000;
    }

    if (unit === "h") {
        ms = value * 60 * 60 * 1000;
    }

    if (unit === "m") {
        ms = value * 60 * 1000;
    }

    return {
        infinite: false,
        ms
    };
}

function createKey(durationText, customKey = null) {

    const parsed = parseDuration(durationText);

    if (!parsed) return null;

    let expires = null;

    if (!parsed.infinite) {

        expires =
            new Date(
                Date.now() + parsed.ms
            ).toISOString();
    }

    return {

        key:
            customKey || uuidv4(),

        hwid: null,

        revoked: false,

        expires,

        duration: durationText,

        createdAt:
            new Date().toISOString()
    };
}

function isExpired(keyData) {

    if (!keyData.expires) {
        return false;
    }

    return (
        new Date(keyData.expires) <
        new Date()
    );
}

function canGenerateRoleKey(userId, roleType) {

    const existing =
        db.data.keys.find(
            k =>
                k.ownerId === userId &&
                k.roleType === roleType &&
                !k.revoked &&
                !isExpired(k)
        );

    return !existing;
}

function formatExpire(date) {

    if (!date) return "∞ Infinito";

    return `<t:${Math.floor(
        new Date(date).getTime() / 1000
    )}:F>`;
}

function getUserKeys(userId) {

    return db.data.keys.filter(
        k => k.ownerId === userId
    );
}

/* ===================================================== */
/* DISCORD */
/* ===================================================== */

const client = new Client({

    intents: [

        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

/* ===================================================== */
/* READY */
/* ===================================================== */

client.on("ready", () => {

    console.log(
        `Bot online: ${client.user.tag}`
    );
});

/* ===================================================== */
/* MESSAGE */
/* ===================================================== */

client.on("messageCreate", async (message) => {

    if (message.author.bot) return;

    const args =
        message.content.split(" ");

    const command =
        args[0].toLowerCase();

    const level =
        getLevel(message.author.id);

    /* ================================================= */
    /* HELP */
    /* ================================================= */
/* ================================================= */
/* KEYS PANEL */
/* ================================================= */

if (command === "!keys") {

    if (level < 2) {

        return message.reply(
            "❌ Sem permissão."
        );
    }

    return message.reply(

        "📋 Painel:\n" +
        "https://keysystem-1v8t.onrender.com/panel"
    );
}

    if (command === "!help") {

        const embed = new EmbedBuilder()

            .setTitle("📘 Help Panel")

            .setColor("Blue")

            .addFields({

                name: "!key",

                value:
                    "Gerar key baseada nos cargos"
            });

        if (level >= 1) {

            embed.addFields({

                name: "!verificar",

                value:
                    "!verificar @user ou id"
            });
        }

        if (level >= 2) {

            embed.addFields(

                {
                    name: "!gerar",

                    value:
                        "!gerar 30d\n!gerar customkey 72h"
                },

                {
                    name: "!edit",

                    value:
                        "!edit KEY desativar\n!edit KEY 30d"
                },

                {
                    name: "!promover",

                    value:
                        "!promover @user 1"
                },

                {
                    name: "!rebaixar",

                    value:
                        "!rebaixar @user"
                }
            );
        }

        return message.reply({
            embeds: [embed]
        });
    }

    /* ================================================= */
    /* KEY */
    /* ================================================= */

    if (command === "!key") {

        if (
            message.channel.id !==
            CHANNEL_KEY
        ) {

            return message.reply(
                "❌ Use o canal correto."
            );
        }

        const member = message.member;

        const generated = [];

        /* 7D */

        if (
            member.roles.cache.has(
                ROLE_7D
            )
        ) {

            if (
                canGenerateRoleKey(
                    message.author.id,
                    "7d"
                )
            ) {

                const keyData =
                    createKey("7d");

                keyData.ownerId =
                    message.author.id;

                keyData.roleType = "7d";

                db.data.keys.push(keyData);

                generated.push(keyData);
            }
        }

        /* 30D */

        if (
            member.roles.cache.has(
                ROLE_30D
            )
        ) {

            if (
                canGenerateRoleKey(
                    message.author.id,
                    "30d"
                )
            ) {

                const keyData =
                    createKey("30d");

                keyData.ownerId =
                    message.author.id;

                keyData.roleType = "30d";

                db.data.keys.push(keyData);

                generated.push(keyData);
            }
        }

        /* INF */

        if (
            member.roles.cache.has(
                ROLE_INF
            )
        ) {

            if (
                canGenerateRoleKey(
                    message.author.id,
                    "inf"
                )
            ) {

                const keyData =
                    createKey("inf");

                keyData.ownerId =
                    message.author.id;

                keyData.roleType = "inf";

                db.data.keys.push(keyData);

                generated.push(keyData);
            }
        }

        await db.write();

        if (generated.length <= 0) {

            return message.reply(
                "❌ Você já gerou todas as keys disponíveis."
            );
        }

        const embed = new EmbedBuilder()

            .setTitle("🔑 Keys Geradas")

            .setColor("Green");

        for (const k of generated) {

            embed.addFields({

                name:
                    `Plano ${k.roleType}`,

                value:
                    `Key: \`${k.key}\`\n` +
                    `Expira: ${formatExpire(k.expires)}`
            });
        }

        return message.reply({
            embeds: [embed]
        });
    }

    /* ================================================= */
    /* VERIFY */
    /* ================================================= */

    if (command === "!verificar") {

        if (level < 1) {

            return message.reply(
                "❌ Sem permissão."
            );
        }

        const target =
            message.mentions.users.first()
            ||
            await client.users.fetch(
                args[1]
            ).catch(() => null);

        if (!target) {

            return message.reply(
                "❌ Usuário inválido."
            );
        }

        const keys =
            getUserKeys(target.id);

        const embed = new EmbedBuilder()

            .setTitle(
                `📋 Keys de ${target.username}`
            )

            .setColor("Blue");

        if (keys.length <= 0) {

            embed.setDescription(
                "Nenhuma key."
            );
        }

        for (const k of keys) {

            embed.addFields({

                name: k.key,

                value:
                    `Plano: ${k.roleType}\n` +
                    `Revogada: ${k.revoked}\n` +
                    `Expira: ${formatExpire(k.expires)}`
            });
        }

        return message.reply({
            embeds: [embed]
        });
    }

    /* ================================================= */
    /* GERAR */
    /* ================================================= */

    if (command === "!gerar") {

        if (level < 2) {

            return message.reply(
                "❌ Sem permissão."
            );
        }

        let customKey = null;
        let duration = null;

        if (args.length === 2) {

            duration = args[1];
        }

        if (args.length >= 3) {

            customKey = args[1];
            duration = args[2];
        }

        const keyData =
            createKey(duration, customKey);

        if (!keyData) {

            return message.reply(
                "❌ Tempo inválido."
            );
        }

        keyData.ownerId =
            message.author.id;

        keyData.roleType =
            "manual";

        db.data.keys.push(keyData);

        await db.write();

        return message.reply(

            `✅ Key gerada:\n\`${keyData.key}\``
        );
    }

    /* ================================================= */
    /* EDIT */
    /* ================================================= */

    if (command === "!edit") {

        if (level < 2) {

            return message.reply(
                "❌ Sem permissão."
            );
        }

        const key =
            args[1];

        const action =
            args[2];

        if (!key || !action) {

            return message.reply(
                "❌ Uso inválido."
            );
        }

        const found =
            db.data.keys.find(
                k => k.key === key
            );

        if (!found) {

            return message.reply(
                "❌ Key não encontrada."
            );
        }  

        if (action === "destruir") {

    db.data.keys =
        db.data.keys.filter(
            k => k.key !== key
        );

    await db.write();

    return message.reply(
        "🗑️ Key destruída permanentemente."
    );
}
        if (
            action === "desativar"
        ) {

            found.revoked = true;
        }

        else if (
            action === "reativar"
        ) {

            found.revoked = false;
        }

        else {

            const parsed =
                parseDuration(action);

            if (!parsed) {

                return message.reply(
                    "❌ Tempo inválido."
                );
            }

            found.duration =
                action;

            if (parsed.infinite) {

                found.expires = null;
            }

            else {

                found.expires =
                    new Date(
                        Date.now() +
                        parsed.ms
                    ).toISOString();
            }
        }

        await db.write();

        return message.reply(
            "✅ Key editada."
        );
    }

    /* ================================================= */
    /* PROMOVER */
    /* ================================================= */

    if (command === "!promover") {

    if (level < 2) {
        return message.reply("❌ Sem permissão.");
    }

    const target =
        message.mentions.users.first()
        ||
        await client.users.fetch(args[1]).catch(() => null);

    if (!target) {
        return message.reply("❌ Usuário inválido.");
    }

    const newLevel = parseInt(args[2]);

    if (isNaN(newLevel)) {
        return message.reply(
            "❌ Use: !promover @user 1 ou !promover @user 2"
        );
    }

    if (level === 2) {

        if (newLevel !== 1) {

            return message.reply(
                "❌ Você só pode promover para nível 1."
            );
        }
    }

    if (level === 3) {

        if (newLevel > 2 || newLevel < 0) {

            return message.reply(
                "❌ Nível máximo permitido é 2."
            );
        }
    }

    setLevel(target.id, newLevel);

    await db.write();

    return message.reply(
        `✅ ${target.username} promovido para nível ${newLevel}`
    );
}

    /* ================================================= */
    /* REBAIXAR */
    /* ================================================= */

    if (command === "!rebaixar") {

        if (level < 2) {

            return message.reply(
                "❌ Sem permissão."
            );
        }

        const target =
            message.mentions.users.first()
            ||
            await client.users.fetch(
                args[1]
            ).catch(() => null);

        if (!target) {

            return message.reply(
                "❌ Usuário inválido."
            );
        }

        const targetLevel =
            getLevel(target.id);

        if (
            level === 2 &&
            targetLevel !== 1
        ) {

            return message.reply(
                "❌ Você só pode rebaixar level 1."
            );
        }

        setLevel(target.id, 0);

        await db.write();

        return message.reply(
            `✅ ${target.username} voltou para level 0`
        );
    }
});

/* ===================================================== */
/* VERIFY API */
/* ===================================================== */

app.post("/verify", async (req, res) => {

    const { key, hwid } = req.body;

    if (!key || !hwid) {

        return res.json({

            valid: false,

            reason: "missing_fields"
        });
    }

    const found =
        db.data.keys.find(
            k => k.key === key
        );

    if (!found) {

        return res.json({

            valid: false,

            reason: "invalid"
        });
    }

    if (found.revoked) {

        return res.json({

            valid: false,

            reason: "revoked"
        });
    }

    if (isExpired(found)) {

        return res.json({

            valid: false,

            reason: "expired"
        });
    }

    if (!found.hwid) {

        found.hwid = hwid;

        await db.write();
    }

    if (found.hwid !== hwid) {

        return res.json({

            valid: false,

            reason: "hwid_mismatch"
        });
    }

    return res.json({

        valid: true,

        expires: found.expires
    });
});
/* ===================================================== */
/* PANEL */
/* ===================================================== */

app.get("/panel", (req, res) => {

    let html = `

    <html>

    <head>

    <title>Key Panel</title>

    <style>

    body {

        background: #0f0f0f;
        color: white;
        font-family: Arial;
        padding: 20px;
    }

    table {

        width: 100%;
        border-collapse: collapse;
    }

    th, td {

        border: 1px solid #333;
        padding: 10px;
        text-align: left;
    }

    th {

        background: #1f1f1f;
    }

    tr:nth-child(even) {

        background: #151515;
    }

    .on {

        color: lime;
        font-weight: bold;
    }

    .off {

        color: red;
        font-weight: bold;
    }

    </style>

    </head>

    <body>

    <h1>Key System Panel</h1>

    <table>

    <tr>

        <th>Key</th>
        <th>User</th>
        <th>Duração</th>
        <th>Status</th>
        <th>Criação</th>
        <th>Expira</th>
        <th>HWID</th>

    </tr>
    `;

    for (const key of db.data.keys) {

        const active =
            !key.revoked &&
            (
                !key.expires ||
                new Date(key.expires) > new Date()
            );

        html += `

        <tr>

            <td>${key.key}</td>

            <td>${key.ownerId}</td>

            <td>${key.duration}</td>

            <td class="${
                active ? "on" : "off"
            }">

                ${
                    active
                    ? "ON"
                    : "OFF"
                }

            </td>

            <td>${key.createdAt || "?"}</td>

            <td>${key.expires || "∞"}</td>

            <td>${key.hwid || "N/A"}</td>

        </tr>
        `;
    }

    html += `

    </table>

    </body>

    </html>
    `;

    res.send(html);
});

/* ===================================================== */
/* START */
/* ===================================================== */

async function start() {

    await db.read();

    db.data ||= {

        keys: [],
        staff: {}
    };
    console.log("TOKEN:", process.env.TOKEN ? "OK" : "MISSING");
    client.login(TOKEN);

    app.listen(PORT, () => {

        console.log(
            `API rodando na porta ${PORT}`
        );
    });
}

start();