require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");
const { joinVoiceChannel, getVoiceConnection } = require("@discordjs/voice");
const { Player } = require("discord-player");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ]
});

const PREFIX = "!";
const player = new Player(client, {
  ytdlOptions: {
    quality: "highestaudio",
    highWaterMark: 1 << 25
  }
});

// Khi bot sẵn sàng
client.once("ready", async () => {
  console.log(`✅ Bot đã online với tên ${client.user.tag}`);
  await player.extractors.loadDefault();
  console.log("🎵 Extractors đã được load!");
});

// Sự kiện khi bài hát bắt đầu phát
player.events.on("playerStart", (queue, track) => {
  queue.metadata.channel.send(`🎶 Đang phát: **${track.title}**`);
});

// Bắt lỗi để debug
player.events.on("error", (queue, err) => {
  console.error("Player error:", err);
  if (queue?.metadata?.channel) queue.metadata.channel.send(`❌ Lỗi player: ${String(err.message || err)}`);
});

player.events.on("connectionError", (queue, err) => {
  console.error("Connection error:", err);
  if (queue?.metadata?.channel) queue.metadata.channel.send(`❌ Lỗi kết nối voice: ${String(err.message || err)}`);
});

// Xử lý lệnh
client.on("messageCreate", async (msg) => {
  if (!msg.content.startsWith(PREFIX) || msg.author.bot) return;

  const args = msg.content.slice(PREFIX.length).trim().split(" ");
  const cmd = args.shift().toLowerCase();

  if (cmd === "join") {
    const vc = msg.member?.voice?.channel;
    if (!vc) return msg.reply("Vào voice đã bro :D");
    joinVoiceChannel({
      channelId: vc.id,
      guildId: vc.guild.id,
      adapterCreator: vc.guild.voiceAdapterCreator,
    });
    msg.reply("✅ Đã join voice!");
  }

  if (cmd === "leave") {
    const connection = getVoiceConnection(msg.guild.id);
    if (!connection) return msg.reply("❌ Bot đang không ở voice!");
    connection.destroy();
    msg.reply("👋 Đã rời voice!");
  }

  if (cmd === "play") {
    const query = args.join(" ");
    if (!query) return msg.reply("🎵 Nhập link hoặc tên bài hát!");

    const vc = msg.member?.voice?.channel;
    if (!vc) return msg.reply("Vào voice đã bro :D");

    const queue = player.nodes.create(msg.guild, {
      metadata: { channel: msg.channel },
    });

    try {
      if (!queue.connection) await queue.connect(vc);
    } catch (e) {
      console.error("Join voice failed:", e);
      queue.delete();
      return msg.reply("❌ Không thể join voice!");
    }

    const result = await player.search(query, {
      requestedBy: msg.author,
    });

    if (!result || !result.tracks.length)
      return msg.reply("❌ Không tìm thấy bài hát hoặc playlist!");

    if (result.playlist) {
      queue.addTrack(result.tracks);
      msg.reply(`📃 Đã thêm playlist **${result.playlist.title}** với ${result.tracks.length} bài!`);
    } else {
      queue.addTrack(result.tracks[0]);
      msg.reply(`🎶 Đã thêm bài: **${result.tracks[0].title}**`);
    }

    try {
      if (!queue.node.isPlaying()) await queue.node.play();
    } catch (e) {
      console.error("Play failed:", e);
      return msg.reply(`❌ Lỗi phát nhạc: ${String(e.message || e)}`);
    }
  }

  if (cmd === "loop") {
    const queue = player.nodes.get(msg.guild.id);
    if (!queue) return msg.reply("❌ Không có nhạc đang phát!");
    queue.setRepeatMode(1);
    msg.reply("🔁 Đã bật loop bài hát!");
  }

  if (cmd === "loopqueue") {
    const queue = player.nodes.get(msg.guild.id);
    if (!queue) return msg.reply("❌ Không có nhạc đang phát!");
    queue.setRepeatMode(2);
    msg.reply("🔁 Đã bật loop toàn queue!");
  }

  if (cmd === "shuffle") {
    const queue = player.nodes.get(msg.guild.id);
    if (!queue) return msg.reply("❌ Không có nhạc đang phát!");
    queue.tracks.shuffle();
    msg.reply("🔀 Đã shuffle queue!");
  }

  if (cmd === "skip") {
    const queue = player.nodes.get(msg.guild.id);
    if (!queue) return msg.reply("❌ Không có nhạc đang phát!");
    queue.node.skip();
    msg.reply("⏭️ Đã skip bài hiện tại!");
  }

  if (cmd === "pause") {
    const queue = player.nodes.get(msg.guild.id);
    if (!queue) return msg.reply("❌ Không có nhạc đang phát!");
    queue.node.pause();
    msg.reply("⏸️ Đã pause nhạc!");
  }

  if (cmd === "resume") {
    const queue = player.nodes.get(msg.guild.id);
    if (!queue) return msg.reply("❌ Không có nhạc đang phát!");
    queue.node.resume();
    msg.reply("▶️ Đã resume nhạc!");
  }
});

client.login(process.env.TOKEN);
