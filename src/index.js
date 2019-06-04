import Discord from "discord.js";
import dotenv from "dotenv";

const controls = [
  { name: "get", description: "Will return this message!" },
  { name: "timer", description: "Sorry, no functions are working right now..." }
];

dotenv.config();

const client = new Discord.Client();

client.on("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on("guildMemberAdd", member => {
  const channel = member.guild.channels.find(
    channel => channel.name === "welcome"
  );
  if (channel === undefined) return;

  const isBot = member.user.bot;
  if (isBot) return;

  const noobRole = member.guild.roles.find(role => role.name === "Stranger");

  member.addRole(noobRole).then(member => {
    channel.send(
      `${member}\nようこそ!\n${member.guild.channels.find(
        channel => channel.name === "terms"
      )} を読んで、同意できる場合は「同意します」とこのチャンネルで送信してください。\n\nWelcome! Please check thourgh rules in ${member.guild.channels.find(
        channel => channel.name === "terms"
      )}, and type "I agree" to agree & get permissions to have fun in this server.`
    );
  });
});

client.on("message", message => {
  const firstQuote = message.content.trim().split(/ |　/)[0];

  if (message.member.roles.find(role => role.name === "Stranger")) {
    validateMessage(message);
    return;
  }

  if (firstQuote === ".help") displayHelp(message);

  if (firstQuote === ".timer") setTimer(message);
});

function validateMessage(message) {
  if (message.channel.name !== "welcome") return;

  if (
    message.content.trim() !== "同意します" &&
    message.content.trim() !== "同意します。" &&
    !message.content.trim().match(/I agree/i)
  ) {
    message.delete();
    return;
  }

  const memberRole = message.guild.roles.find(role => role.name === "Member"),
    noobRole = message.guild.roles.find(role => role.name === "Stranger");

  message.member
    .addRole(memberRole)
    .then(member => {
      member.removeRole(noobRole);
    })
    .catch(console.error);
}

async function displayHelp(message) {
  const embedMessage = new Discord.RichEmbed();

  await embedMessage
    .setAuthor(
      "Whipple",
      "https://www.dropbox.com/s/oguwvbc5kqhaly8/Whipple_slow.gif?dl=1"
    )
    .setColor(0xfa8231);

  await controls.forEach(data => {
    embedMessage.addField("`." + data.name + "`", data.description);
  });

  await message.channel.send(embedMessage);
}

function setTimer() {}

client.login(process.env.BOT_TOKEN);
