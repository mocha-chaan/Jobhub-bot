// ==========================
// 📦 IMPORTS
// ==========================
const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require("discord.js");

// ==========================
// 🔐 CLIENT SETUP
// ==========================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ==========================
// 🔑 CONFIG
// ==========================
const TOKEN = process.env.TOKEN;

// 📘 Channels
const MANUAL_VERIFICATION_CHANNEL_ID = "1456615041766916239";
const VERIFICATION_REQUEST_CHANNEL_ID = "1456804805270962352";
const WELCOME_CHANNEL_ID = "1456613062105890950";
const BUMP_REMINDER_CHANNEL_ID = "1456618096541306940";
const JOBSEEKER_AD_CHANNEL_ID = "1456616874023456871";
const HIRING_AD_CHANNEL_ID = "1456615270301831303";


// 👤 Roles
const HIRING_UNVERIFIED_ROLE_ID = "1456605342065492029";
const JOBSEEKER_UNVERIFIED_ROLE_ID = "1456605560177819658";
const HIRING_VERIFIED_ROLE_ID = "1456604270248853595";
const JOBSEEKER_VERIFIED_ROLE_ID = "1456604858344935543";

// 🧠 Memory (prevents duplicate requests)
const verificationRequests = new Set();
const verificationCooldown = new Map();

// ⏱ Cooldown time (in ms)
const VERIFICATION_COOLDOWN = 5 * 60 * 1000;


// ==========================
// 🟢 READY
// ==========================
client.once("clientReady", () => {
  console.log("✅ JobHub bot is online!");
});

// ==========================
// 👋 WELCOME MESSAGE
// ==========================
client.on("guildMemberAdd", async (member) => {
  const channel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
  if (!channel) return;

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("choose_hiring")
      .setLabel("🧑‍💼 Hiring")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("choose_jobseeker")
      .setLabel("💼 Job Seeker")
      .setStyle(ButtonStyle.Success)
  );

  await channel.send({
    content:
      "👋 **Welcome to JobHub**\n\n" +
      "Please choose how you want to continue:",
    components: [row]
  });
});

// ==========================
// 🔘 INTERACTIONS (ONE ONLY)
// ==========================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isButton()) return;

  const member = interaction.member;

  try {
    // 🧑‍💼 HIRING
    if (interaction.customId === "choose_hiring") {
      await interaction.deferReply({ flags: 64 });
      await member.roles.add(HIRING_UNVERIFIED_ROLE_ID);

      return interaction.editReply(
        "🧑‍💼 **Hiring selected**\n\n" +
        "📘 Read the **#rules-hiring**" +
        "📝 Then request **verification for posting in #manual-verification**."
      );
    }

    // 💼 JOB SEEKER
    if (interaction.customId === "choose_jobseeker") {
      await interaction.deferReply({ flags: 64 });
      await member.roles.add(JOBSEEKER_UNVERIFIED_ROLE_ID);

      return interaction.editReply(
        "💼 **Job Seeker selected**\n\n" +
        "📘 Read the **#rules-jobseeker**" +
        "📝 Then request **verification for posting in #manual-verification**."
      );
    }

    // 📤 REQUEST VERIFICATION
   if (interaction.customId === "request_verification") {

  const now = Date.now();
  const lastRequest = verificationCooldown.get(interaction.user.id);

  // ⏳ Cooldown check
  if (lastRequest && now - lastRequest < VERIFICATION_COOLDOWN) {
    const remaining = VERIFICATION_COOLDOWN - (now - lastRequest);
    const minutes = Math.ceil(remaining / 60000);

    return interaction.reply({
      content: `⏳ You must wait **${minutes} minutes** before requesting verification again.`,
      flags: 64
    });
  }

  // ❌ Already pending
  if (verificationRequests.has(interaction.user.id)) {
    return interaction.reply({
      content: "⛔ You already have a pending verification request.",
      flags: 64
    });
  }

  // ✅ Store request
  verificationRequests.add(interaction.user.id);
  verificationCooldown.set(interaction.user.id, now);

  await interaction.deferReply({ flags: 64 });

  const staffChannel = interaction.guild.channels.cache.get(
    VERIFICATION_REQUEST_CHANNEL_ID
  );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`approve_${interaction.user.id}`)
      .setLabel("✅ Approve")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`reject_${interaction.user.id}`)
      .setLabel("❌ Reject")
      .setStyle(ButtonStyle.Danger)
  );

  await staffChannel.send({
    content: `📝 **Verification Request**\n\nUser: ${interaction.user}`,
    components: [row]
  });

  return interaction.editReply(
    "📨 **Request sent!**\n\n" +
    "A moderator will review your request shortly."
  );
}

    // ✅ APPROVE
  if (interaction.customId.startsWith("approve_")) {
  await interaction.deferReply({ flags: 64 });

  const userId = interaction.customId.split("_")[1];
  const target = await interaction.guild.members.fetch(userId);

  const channel = interaction.guild.channels.cache.get(
    MANUAL_VERIFICATION_CHANNEL_ID
  );

  let roleLabel = "";

  if (target.roles.cache.has(HIRING_UNVERIFIED_ROLE_ID)) {
    await target.roles.remove(HIRING_UNVERIFIED_ROLE_ID);
    await target.roles.add(HIRING_VERIFIED_ROLE_ID);
    roleLabel = "Hiring";
  }

  if (target.roles.cache.has(JOBSEEKER_UNVERIFIED_ROLE_ID)) {
    await target.roles.remove(JOBSEEKER_UNVERIFIED_ROLE_ID);
    await target.roles.add(JOBSEEKER_VERIFIED_ROLE_ID);
    roleLabel = "Job Seeker";
  }

  // 📢 PUBLIC MESSAGE
  await channel.send(
    `✅ **Approved for Posting**\n\n` +
    `${target} has been approved as **${roleLabel}**.\n` +
    `You may now post in the advertising channels.`
  );

  // 🧹 DELETE STAFF REQUEST
  await interaction.message.delete().catch(() => {});

  verificationRequests.delete(userId);

  return interaction.editReply("✅ Approval complete.");
}

      
    // ❌ REJECT
  if (interaction.customId.startsWith("reject_")) {
  await interaction.deferReply({ flags: 64 });

  const userId = interaction.customId.split("_")[1];
  const target = await interaction.guild.members.fetch(userId);

  const channel = interaction.guild.channels.cache.get(
    MANUAL_VERIFICATION_CHANNEL_ID
  );

  // 📢 PUBLIC MESSAGE
  await channel.send(
    `❌ **Request Rejected**\n\n` +
    `${target}, your request to **verify for posting** was not approved.\n` +
    `Please contact staff if you need clarification.`
  );

  // 🧹 DELETE STAFF REQUEST
  await interaction.message.delete().catch(() => {});

  verificationRequests.delete(userId);

  return interaction.editReply("❌ Rejection sent.");
}

} catch (err) {
    console.error(err);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({
        content: "❌ Something went wrong.",
        flags: 64
      });
    }
  }
});

// ==========================
// 🧹 ADVERTISE MODERATION
// ==========================
client.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  // ⛔ BLOCK UNVERIFIED USERS FIRST
  if (
    message.channel.id === JOBSEEKER_AD_CHANNEL_ID &&
    !message.member.roles.cache.has(JOBSEEKER_VERIFIED_ROLE_ID)
  ) {
    await message.delete().catch(() => {});
    return;
  }

  if (
    message.channel.id === HIRING_AD_CHANNEL_ID &&
    !message.member.roles.cache.has(HIRING_VERIFIED_ROLE_ID)
  ) {
    await message.delete().catch(() => {});
    return;
  }

  // ==========================
  // 🟦 JOB SEEKER RULES
  // ==========================
  if (message.channel.id === JOBSEEKER_AD_CHANNEL_ID) {
    const content = message.content;

    const sentences = content.split(/[.!?]/).filter(Boolean).length;
    const hasContact = /(dm|email|@|discord)/i.test(content);
    const hasPrice = /(\$|\bhr\b|\bhour\b|\bper\b|\bnegotiable\b)/i.test(content);

    if (sentences < 2 || !hasContact || !hasPrice) {
      await message.delete().catch(() => {});
      const warn = await message.channel.send(
  `❌ **Post Removed – Job Seeker Rules**\n\n` +
  `• Min **2 sentences**\n` +
  `• **Price range** (state if negotiable)\n` +
  `• **Contact method**\n\n` +
  `${message.author}`
);

setTimeout(() => warn.delete().catch(() => {}), 10000);
return;
    }
  }

  // ==========================
  // 🟪 HIRING RULES
  // ==========================
  if (message.channel.id === HIRING_AD_CHANNEL_ID) {
    const content = message.content;

    const sentences = content.split(/[.!?]/).filter(Boolean).length;
    const hasContact = /(dm|email|@|discord)/i.test(content);
    const hasPay = /(\$|\bhr\b|\bhour\b|\bper\b)/i.test(content);

    if (sentences < 3 || !hasContact || !hasPay) {
      await message.delete().catch(() => {});
      const warn = await message.channel.send(
  `❌ **Post Removed – Hiring Rules**\n\n` +
  `• Min **3 sentences**\n` +
  `• **Payment amount** (ex. $10/hr)\n` +
  `• **Contact method**\n\n` +
  `${message.author}`
);

setTimeout(() => warn.delete().catch(() => {}), 10000);
return;
    }
  }
});

// ==========================
// 🚀 LOGIN
// ==========================
client.login(TOKEN);
