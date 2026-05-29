require("dotenv").config();

const express = require("express");

const {
	Client,
	GatewayIntentBits,
	EmbedBuilder
} = require("discord.js");

const { v4: uuidv4 } = require("uuid");

const { Low } = require("lowdb");

const { JSONFile } = require("lowdb/node");

/* ===================================================== */
/* APP */
/* ===================================================== */

const app = express();

app.use(express.json());

/* ===================================================== */
/* DATABASE */
/* ===================================================== */

const adapter =
	new JSONFile("./db.json");

const db =
	new Low(adapter, {

		keys: [],
		staff: {}
	});

/* ===================================================== */
/* CONFIG */
/* ===================================================== */

const TOKEN =
	process.env.TOKEN;

const PORT =
	process.env.PORT || 3000;

const PREFIX = "!";

const CHANNEL_KEY =
	"1509913554692735016";

const OWNER_IDS = [

	"933025502095102012",
	"1504981387294281768"
];

/* ===================================================== */
/* ROLES */
/* ===================================================== */

const ROLE_7D =
	"1509913837661458594";

const ROLE_30D =
	"1509913884868477039";

const ROLE_INF =
	"1509913892703305748";

/* ===================================================== */
/* HELPERS */
/* ===================================================== */

function getLevel(userId) {

	if (
		OWNER_IDS.includes(userId)
	) {

		return 3;
	}

	return (
		db.data.staff[userId]
		||
		0
	);
}

function setLevel(userId, level) {

	db.data.staff[userId] =
		level;
}

function parseDuration(input) {

	if (!input) return null;

	input =
		input.toLowerCase();

	if (input === "inf") {

		return {

			infinite: true,

			ms: null
		};
	}

	const match =
		input.match(
			/^(\d+)([dhm])$/
		);

	if (!match) return null;

	const value =
		Number(match[1]);

	const unit =
		match[2];

	let ms = 0;

	if (unit === "d") {

		ms =
			value
			*
			24
			*
			60
			*
			60
			*
			1000;
	}

	if (unit === "h") {

		ms =
			value
			*
			60
			*
			60
			*
			1000;
	}

	if (unit === "m") {

		ms =
			value
			*
			60
			*
			1000;
	}

	return {

		infinite: false,

		ms
	};
}

function createKey(
	durationText,
	customKey = null
) {

	const parsed =
		parseDuration(
			durationText
		);

	if (!parsed) return null;

	let expires = null;

	if (!parsed.infinite) {

		expires =
			new Date(

				Date.now()
				+
				parsed.ms

			).toISOString();
	}

	return {

		key:
			customKey
			||
			uuidv4(),

		hwid: null,

		revoked: false,

		expires,

		duration:
			durationText,

		createdAt:
			new Date().toISOString()
	};
}

function isExpired(keyData) {

	if (!keyData.expires) {

		return false;
	}

	return (

		new Date(
			keyData.expires
		)

		<

		new Date()
	);
}

function formatExpire(date) {

	if (!date) {

		return "∞ Infinito";
	}

	return `<t:${Math.floor(

		new Date(date).getTime()
		/
		1000

	)}:F>`;
}

function getUserKeys(userId) {

	return db.data.keys.filter(

		k =>
			k.ownerId === userId
	);
}

/* ===================================================== */
/* DISCORD */
/* ===================================================== */

const client =
	new Client({

		intents: [

			GatewayIntentBits.Guilds,

			GatewayIntentBits.GuildMessages,

			GatewayIntentBits.MessageContent,

			GatewayIntentBits.GuildMembers
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

client.on(
	"messageCreate",
	async (message) => {

	if (
		message.author.bot
	) return;

	if (
		!message.content.startsWith(PREFIX)
	) return;

	const args =
		message.content
		.trim()
		.split(/ +/);

	const command =
		args[0]
		.toLowerCase();

	const level =
		getLevel(
			message.author.id
		);

	/* ===================================================== */
	/* HELP */
	/* ===================================================== */

	if (command === "!help") {

		const embed =
			new EmbedBuilder()

			.setTitle(
				"📘 Help Panel"
			)

			.setColor("Blue")

			.setDescription(

				[
					"`!key`",
					"`!help`",

					level >= 1
					? "`!verificar`"
					: "",

					level >= 2
					? "`!gerar`\n`!edit`\n`!promover`\n`!rebaixar`\n`!keys`"
					: ""
				]
				.filter(Boolean)
				.join("\n")
			);

		return message.reply({
			embeds: [embed]
		});
	}

	/* ===================================================== */
	/* KEY */
	/* ===================================================== */

	if (command === "!key") {

		if (
			message.channel.id !==
			CHANNEL_KEY
		) {

			return message.reply(
				"❌ Use o canal correto."
			);
		}

		const member =
			message.member;

		const result = [];

		async function processRole(

			roleId,
			roleType,
			duration

		) {

			if (
				!member.roles.cache.has(roleId)
			) return;

			const existing =
				db.data.keys.find(

					k =>

						k.ownerId === message.author.id
						&&
						k.roleType === roleType
						&&
						!isExpired(k)
				);

			if (existing) {

				result.push({

					type: "existing",

					data: existing
				});

				return;
			}

			const keyData =
				createKey(duration);

			keyData.ownerId =
				message.author.id;

			keyData.roleType =
				roleType;

			db.data.keys.push(
				keyData
			);

			result.push({

				type: "new",

				data: keyData
			});
		}

		await processRole(
			ROLE_7D,
			"7d",
			"7d"
		);

		await processRole(
			ROLE_30D,
			"30d",
			"30d"
		);

		await processRole(
			ROLE_INF,
			"inf",
			"inf"
		);

		await db.write();

		if (
			result.length <= 0
		) {

			return message.reply(
				"❌ Você não possui cargos."
			);
		}

		const embed =
			new EmbedBuilder()

			.setTitle(
				"🔑 Suas Keys"
			)

			.setColor("Blue");

		for (const item of result) {

			const k =
				item.data;

			const active =
				!k.revoked
				&&
				!isExpired(k);

			embed.addFields({

				name:
					item.type === "new"
					? `🆕 ${k.roleType}`
					: `♻️ ${k.roleType}`,

				value:

					`Key: \`${k.key}\`\n`

					+

					`Status: ${
						active
						? "🟢 ON"
						: "🔴 OFF"
					}\n`

					+

					`Expira: ${
						formatExpire(
							k.expires
						)
					}`
			});
		}

		return message.reply({
			embeds: [embed]
		});
	}

	/* ===================================================== */
	/* VERIFICAR */
	/* ===================================================== */

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
			getUserKeys(
				target.id
			);

		const embed =
			new EmbedBuilder()

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

			const active =
				!k.revoked
				&&
				!isExpired(k);

			embed.addFields({

				name: k.key,

				value:

					`Plano: ${k.roleType}\n`

					+

					`Status: ${
						active
						? "🟢 ON"
						: "🔴 OFF"
					}\n`

					+

					`HWID: ${
						k.hwid || "N/A"
					}\n`

					+

					`Expira: ${
						formatExpire(
							k.expires
						)
					}`
			});
		}

		return message.reply({
			embeds: [embed]
		});
	}

	/* ===================================================== */
	/* KEYS */
	/* ===================================================== */

	if (command === "!keys") {

		if (level < 2) {

			return message.reply(
				"❌ Sem permissão."
			);
		}

		if (args[1]) {

			const found =
				db.data.keys.find(

					k =>
						k.key === args[1]
				);

			if (!found) {

				return message.reply(
					"❌ Key não encontrada."
				);
			}

			const active =
				!found.revoked
				&&
				!isExpired(found);

			const embed =
				new EmbedBuilder()

				.setTitle(
					"🔍 Key Info"
				)

				.setColor(
					active
					? "Green"
					: "Red"
				)

				.addFields(

					{
						name: "Key",
						value:
							`\`${found.key}\``
					},

					{
						name: "Usuário",
						value:
							found.ownerId
					},

					{
						name: "Plano",
						value:
							found.roleType
					},

					{
						name: "Status",
						value:
							active
							? "🟢 ON"
							: "🔴 OFF"
					},

					{
						name: "HWID",
						value:
							found.hwid || "N/A"
					},

					{
						name: "Criada",
						value:
							found.createdAt
					},

					{
						name: "Expira",
						value:
							found.expires || "∞"
					}
				);

			return message.reply({
				embeds: [embed]
			});
		}

		return message.reply(

			"📋 Painel:\n"
			+
			"https://keysystem-1v8t.onrender.com/panel"
		);
	}

	/* ===================================================== */
	/* GERAR */
	/* ===================================================== */

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
			createKey(
				duration,
				customKey
			);

		if (!keyData) {

			return message.reply(
				"❌ Tempo inválido."
			);
		}

		keyData.ownerId =
			message.author.id;

		keyData.roleType =
			"manual";

		db.data.keys.push(
			keyData
		);

		await db.write();

		return message.reply(

			`✅ Key gerada:\n\`${keyData.key}\``
		);
	}

	/* ===================================================== */
	/* EDIT */
	/* ===================================================== */

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

				k =>
					k.key === key
			);

		if (!found) {

			return message.reply(
				"❌ Key não encontrada."
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

		else if (
			action === "destruir"
		) {

			if (level < 3) {

				return message.reply(
					"❌ Apenas level 3."
				);
			}

			db.data.keys =
				db.data.keys.filter(

					k =>
						k.key !== key
				);

			await db.write();

			return message.reply(
				"🗑️ Key destruída."
			);
		}

		else {

			const parsed =
				parseDuration(
					action
				);

			if (!parsed) {

				return message.reply(
					"❌ Tempo inválido."
				);
			}

			found.duration =
				action;

			if (
				parsed.infinite
			) {

				found.expires = null;
			}

			else {

				found.expires =
					new Date(

						Date.now()
						+
						parsed.ms

					).toISOString();
			}
		}

		await db.write();

		return message.reply(
			"✅ Key editada."
		);
	}

	/* ===================================================== */
	/* PROMOVER */
	/* ===================================================== */

	if (command === "!promover") {

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

		const targetLevel =
			parseInt(args[2]);

		if (
			isNaN(targetLevel)
		) {

			return message.reply(
				"❌ Level inválido."
			);
		}

		if (!target) {

			return message.reply(
				"❌ Usuário inválido."
			);
		}

		if (
			level === 2
			&&
			targetLevel !== 1
		) {

			return message.reply(
				"❌ Level 2 só promove para 1."
			);
		}

		if (
			level === 3
			&&
			targetLevel > 2
		) {

			return message.reply(
				"❌ Máximo level 2."
			);
		}

		setLevel(
			target.id,
			targetLevel
		);

		await db.write();

		return message.reply(

			`✅ ${target.username} agora é level ${targetLevel}`
		);
	}

	/* ===================================================== */
	/* REBAIXAR */
	/* ===================================================== */

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
			level === 2
			&&
			targetLevel !== 1
		) {

			return message.reply(
				"❌ Você só pode rebaixar level 1."
			);
		}

		setLevel(
			target.id,
			0
		);

		await db.write();

		return message.reply(

			`✅ ${target.username} voltou para level 0`
		);
	}
});

/* ===================================================== */
/* VERIFY API */
/* ===================================================== */

app.post(
	"/verify",
	async (req, res) => {

	const {
		key,
		hwid
	} = req.body;

	if (
		!key
		||
		!hwid
	) {

		return res.json({

			valid: false,

			reason:
				"missing_fields"
		});
	}

	const found =
		db.data.keys.find(

			k =>
				k.key === key
		);

	if (!found) {

		return res.json({

			valid: false,

			reason:
				"invalid"
		});
	}

	if (found.revoked) {

		return res.json({

			valid: false,

			reason:
				"revoked"
		});
	}

	if (
		isExpired(found)
	) {

		return res.json({

			valid: false,

			reason:
				"expired"
		});
	}

	if (!found.hwid) {

		found.hwid =
			hwid;

		await db.write();
	}

	if (
		found.hwid !== hwid
	) {

		return res.json({

			valid: false,

			reason:
				"hwid_mismatch"
		});
	}

	return res.json({

		valid: true,

		expires:
			found.expires
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

			!key.revoked

			&&

			(
				!key.expires
				||
				new Date(
					key.expires
				)
				>
				new Date()
			);

		html += `

		<tr>

		<td>${key.key}</td>

		<td>${key.ownerId}</td>

		<td>${key.duration}</td>

		<td class="${
			active
			? "on"
			: "off"
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

	client.login(TOKEN);

	app.listen(PORT, () => {

		console.log(

			`API rodando na porta ${PORT}`
		);
	});
}

start();