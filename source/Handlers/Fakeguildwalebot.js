const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ChannelType,
} = require("discord.js");
const GuildSchema = require("../Models/Guild");

module.exports = async function AvonDispatcher(client, kazagumo) {
  kazagumo.on("playerStart", async (player, track) => {
    if (track.length < 5000) {
      player.skip();
      const executionChannelId = player.data.get("executionChannel");
      const channel = client.channels.cache.get(executionChannelId);
      if (channel) {
        channel
          .send({ content: `- Track is less than **5 seconds**. Skipping.` })
          .then((msg) => setTimeout(() => msg.delete(), 5000));
      }
      return;
    }

    const guildData = await GuildSchema.findOne({ id: player.guildId });
    const executionChannelId = player.data.get("executionChannel");
    const channel = client.channels.cache.get(executionChannelId);
    
    if (!channel) {
      console.error(`Execution channel not found for guild: ${player.guildId}`);
      return;
    }

    const title = track.title;
    const author = track.author;
    const thumbnail = track.thumbnail;
    const url = track.uri;
    const requester = track.requester;
    
    const nowPlaying = new EmbedBuilder()
      .setAuthor({ name: `Now Playing`, iconURL: client.user.displayAvatarURL() })
      .setColor(client.config.color)
      .setThumbnail(thumbnail)
      .setDescription(`**[${title}](${url})** by **${author}**`)
      .addFields(
        { name: "<a:x_dot:1345324448491769877> Chosen by", value: `[${requester.globalName ?? requester.username}](https://discord.com/users/${requester.id})`, inline: true },
        { name: "<a:x_dot:1345324448491769877> Duration", value: track.isStream ? "Live" : await client.utils.convertTime(track.length), inline: true }
      )
      .setFooter({
        text: `Autoplay - ${guildData.settings.autoplay ? "Enabled" : "Disabled"} ⁠・ Volume - ${player.volume}% ⁠・ Queue - ${player.queue.length}`,
        iconURL: requester.displayAvatarURL(),
      });

    const buttonsRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("previous").setStyle(client.btn.grey).setEmoji("1131847086053269575"),
      new ButtonBuilder().setCustomId("PauseAndResume").setEmoji("1131847861299068948").setStyle(client.btn.grey),
      new ButtonBuilder().setCustomId("stop").setEmoji("1301593382057152542").setStyle(client.btn.red),
      new ButtonBuilder().setEmoji("1131847099361792082").setCustomId("settings").setStyle(client.btn.grey),
      new ButtonBuilder().setEmoji("1131847093925969990").setCustomId("skip").setStyle(client.btn.grey)
    );

    await channel.send({ embeds: [nowPlaying], components: [buttonsRow] }).then((msg) => player.data.set("message", msg));
  });

  kazagumo.on("playerEnd", async (player) => {
    const executionChannelId = player.data.get("executionChannel");
    const channel = client.channels.cache.get(executionChannelId);
    const msg = player.data.get("message");

    if (channel && msg) {
      channel.messages.fetch(msg.id).then((message) => message.delete()).catch(() => {});
    }
  });

  kazagumo.on("playerEmpty", async (player) => {
    const executionChannelId = player.data.get("executionChannel");
    const channel = client.channels.cache.get(executionChannelId);
    if (!channel) return;

    player.data.get("message")?.delete();

    const data = await GuildSchema.findOne({ id: player.guildId });
    if (data && data.settings.autoplay) {
      client.utils.AvonAutoplay(player, player.data?.get("url"));
    } else {
      const embed = new EmbedBuilder()
        .setColor(client.config.color)
        .setAuthor({ name: "No more tracks in the queue. Leaving the voice channel.", iconURL: client.user.avatarURL() });

      channel.send({ embeds: [embed] }).then((msg) => setTimeout(() => msg.delete(), 80000 * 10 * 2));
    }
  });

  kazagumo.on("playerDestroy", async (player) => {
    const executionChannelId = player.data.get("executionChannel");
    const channel = client.channels.cache.get(executionChannelId);
    if (!channel) return;

    try {
      const data = await GuildSchema.findOne({ id: player.guildId });
      if (data.twentyFourSeven.enabled) {
        await client.kazagumo.createPlayer({
          guildId: data.id,
          textId: data.twentyFourSeven.textChannel,
          voiceId: data.twentyFourSeven.voiceChannel,
          deaf: true,
        });
      }
      const msg = player.data.get("message")?.id;
      if (msg) {
        channel.messages.fetch(msg).then((message) => message.delete()).catch(() => {});
      }
    } catch (e) {
      console.error(e);
    }
  });

  kazagumo.on("playerMoved", async (player, state, channels) => {
    const executionChannelId = player.data.get("executionChannel");
    const channel = client.channels.cache.get(executionChannelId);
    if (!channel) return;

    if (state === "UNKNOWN") {
      player.destroy();
      channel.send({ content: "- Unable to move to the new channel. Destroying player." }).then((msg) => setTimeout(() => msg.delete(), 8000));
    } else if (state === "MOVED") {
      player.setVoiceChannel(channels.newChannelId);
      if (player.paused) player.pause(false);
      channel.send({ content: `- Moved from **${channels.oldChannelId}** to **${channels.newChannelId}**.` }).then((msg) => setTimeout(() => msg.delete(), 8000));
    } else if (state === "LEFT") {
      player.destroy();
      channel.send({ content: "- I was moved out. Destroying player." }).then((msg) => setTimeout(() => msg.delete(), 8000));
    }
  });

  kazagumo.on("playerStuck", async (player, data) => {
    const executionChannelId = player.data.get("executionChannel");
    const channel = client.channels.cache.get(executionChannelId);
    if (!channel) return;

    channel.send({ content: `- Track stuck for ${data.threshold}ms. Skipping...` }).then((msg) => setTimeout(() => msg.delete(), 5000));
    player.skip();
  });
};
