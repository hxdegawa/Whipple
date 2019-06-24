import Discord from "discord.js";
import dotenv from "dotenv";
import Clarifai from "clarifai";
import request from 'request-promise';
import m3u8stream from 'm3u8stream';
import cron from 'node-cron';
import { format, getSeconds, subMinutes } from 'date-fns'
import { Base64 } from 'js-base64';

const controls = [
  { name: "help", description: "Will return this message!" },
  { name: "timer", description: "Sorry, no functions are working right now..." },
  { name: "play", description: "Plays radio! (type `.play help` for more info)" },
  { name: "stop", description: "Stops playing radio." }
];

dotenv.config();

const client = new Discord.Client();
let streamCron = false;

client.on("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.on("guildMemberAdd", member => {
  const channel = member.guild.channels.find(
    channel => channel.name === "welcome"
  );

  if (channel === undefined) return;

  if (member.user.bot) return;

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

  if (message.author.bot) return;

  if (!message.guild) {
    message.reply(`sorry, ${client.user.tag} is not available with direct message. Please contact to @orihorih#0013 if you find any problem.`);
    return;
  };

  if (message.member.roles.find(role => role.name === "Stranger")) {
    validateMessage(message);
    return;
  };

  // COMMAND DETECTION

  if (firstQuote === ".help")  displayHelp(message);

  if (firstQuote === ".timer") setTimer(message);

  if (firstQuote === ".study") concentrate(message);

  if (firstQuote === ".radio") playRadio(message);

  if (firstQuote === ".stop")  stopRadio(message);

  if (message.attachments.find(attachment => inspectImage(attachment.url, message)));

  setTimeout(() => {
    if (message.embeds) {
      message.embeds.find(result => inspectImage(result.message.embeds[0].thumbnail.url, message))};
  }, 1500);
});

const validateMessage = message => {
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
        noobRole   = message.guild.roles.find(role => role.name === "Stranger");

  message.member
    .addRole(memberRole)
    .then(member => {
      member.removeRole(noobRole);
    })
    .catch(console.error);
}

const displayHelp = async message => {
  const embedMessage = new Discord.RichEmbed();

  await embedMessage
    .setAuthor(
      "Whipple",
      process.env.BOT_ICON
    )
    .setColor(0xfa8231);

  await controls.forEach(data => {
    embedMessage.addField("`." + data.name + "`", data.description);
  });

  await message.channel.send(embedMessage);
}

const setTimer = message => {
  message.channel.send("Sorry, this function is still under construction!");
}

const inspectImage = async (url, message) => {
  const clarifai = new Clarifai.App({
    apiKey: process.env.CLARIFAI_TOKEN
   });

  clarifai.models.predict("e9576d86d2004ed1a38ba0cf39ecb4b1", url)
  .then(async response => {
    if (response.outputs[0].data.concepts[0].name === "nsfw") {
      const suspendedImage = new Discord.Attachment(url, "SPOILER_nsfw.png");
      const embedMessage   = new Discord.RichEmbed();

      await embedMessage
      .setAuthor(message.author.username, message.author.avatarURL)
      .addField('🚨Suspicious message🚨', message.content ? message.content : url)
      .attachFile(suspendedImage)
      .setColor(0xEA2027);

      await message.channel.send(embedMessage);
      await message.delete();
    };
  })
  .catch(console.error);
}

const getToken = (connection, station) => {

  const v1Options = {
    uri: 'https://radiko.jp/v2/api/auth1',
    transform: (body, response, resolveWithFullResponse) => {
      return response
    },
    headers: {
      'Content-Type'        : "application/json",
      'X-Radiko-App'        : "pc_html5",
      'X-Radiko-App-Version': "0.0.1",
      'X-Radiko-User'       : "Whipple",
      'X-Radiko-Device'     : "pc"
    },
    json: true
  };

  request(v1Options)
  .then(response => {
    getKey(
      response.headers["x-radiko-authtoken"],
      response.headers["x-radiko-keylength"],
      response.headers["x-radiko-keyoffset"],
      connection,
      station
    );
  })
  .catch(err => {
    console.error(err);
  })
}

const getKey = async (token, keyLength, keyOffset, connection, station) => {
  const v2Options = {
    uri: 'https://radiko.jp/v2/api/auth2',
    transform: (body, response, resolveWithFullResponse) => {
      return response
    },
    headers: {
      'Content-Type'        : "application/json",
      'X-Radiko-AuthToken'  : token,
      'X-Radiko-PartialKey' : calcToken(keyLength, keyOffset),
      'X-Radiko-User'       : "Whipple",
      'X-Radiko-Device'     : "pc"
    },
    json: true
  };

  request(v2Options)
  .then(() => {
    playAudio(token, connection, station);
  })
  .catch(err => {
    console.error(err);
  })
}

const calcToken = (keyLength, keyOffset) => {
  const baseKey = process.env.RADIKO_KEY;
  const partialKey = baseKey.slice(keyOffset, parseInt(keyLength, 10) + parseInt(keyOffset, 10));
  return Base64.encode(partialKey);
}

const playAudio = (token, connection, station) => {

  const m3u8Options = {
    uri: `https://radiko.jp/v2/api/ts/playlist.m3u8?station_id=${station}&l=15&ft=${format(subMinutes(new Date(), 2), 'YYYYMMDDHHmm00')}&to=${format(subMinutes(new Date(), 1), 'YYYYMMDDHHmm00')}`,
    transform: body => {
      return body
    },
    headers: {
      'X-Radiko-AuthToken': token
    },
    json: true
  };

  request(m3u8Options)
  .then(data => {
    connection.playStream(m3u8stream(data.split("\n")[3]), {volume: 0.1});
  })
  .catch(err => {
    console.error(err);
  });
}

const playRadio = async message => {
  const availableFreq = {
    'TBS'            : {name: "TBSラジオ"},
    'QRR'            : {name: "文化放送"},
    'LFR'            : {name: "ニッポン放送"},
    'INT'            : {name: "InterFM897"},
    'FMJ'            : {name: "J-WAVE"},
    'JORF'           : {name: "ラジオ日本"},
    'BAYFM78'        : {name: "Bayfm78"},
    'NACK5'          : {name: "NACK5"},
    'YFM'            : {name: "FMヨコハマ"},
    'RN1'            : {name: "ラジオNIKKEI第1"},
    'RN2'            : {name: "ラジオNIKKEI第2"},
    'HOUSOU-DAIGAKU' : {name: "放送大学"}
  }

  const fullMessage = message.content.trim().split(/ |　/);

  if (fullMessage[1] === 'help' || fullMessage[1] === undefined) {
    const embedMessage = new Discord.RichEmbed();

    await embedMessage
    .setAuthor("Available radio stations below...", process.env.BOT_ICON)
    .setColor(0xfa8231)
    .addField('To use radio, please send me with following format:\n```.play TBS```', 'This "TBS" is the id of radio station, and can be replaced with those station ids.')
    .addBlankField();

    await Object.keys(availableFreq).forEach(key => {
      embedMessage.addField(availableFreq[key].name, '`' + key + '`', true);
    });

    await message.channel.send(embedMessage);
    return;
  }

  if (!message.member.voiceChannel) {
    message.channel.send("You need to join a voice channel first!");
    return;
  }

  if (fullMessage[1] in availableFreq) {
    streamCron ? streamCron.destroy() : null;
    message.member.voiceChannel.join().then(connection => {
      getToken(connection, fullMessage[1]);
      streamCron = cron.schedule(`${getSeconds(new Date())} * * * * *`, () => {
        getToken(connection, fullMessage[1]);
      });
      streamCron.start();
    })
  } else {
    message.channel.send(`Station ID '${fullMessage[1]}' doesn't exists in our list of stations...`);
  }
}

const stopRadio = message => {
  message.member.voiceChannel.leave();
}

const concentrate = message => {
  if (!message.member.voiceChannel) {
    message.channel.send("Join some voice channel first!");
    return;
  }

  const channel = message.guild.channels.find(channel => channel.name === "study");
  message.member.setVoiceChannel(channel);
}

client.login(process.env.BOT_TOKEN);
client.on('error', console.error);
