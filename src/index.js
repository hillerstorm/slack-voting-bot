const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');
var emoji = require('../assets/emoji');

const botToken = process.env.BOT_TOKEN || '';
const appToken = process.env.APP_TOKEN || '';
const app = express();

app.set('port', process.env.PORT || 5000);
app.use(bodyParser.urlencoded({extended: false}));

const addReactions = (channelId, timestamp, reactions) => {
  const reaction = reactions[0];
  if (reaction) {
    request.post({
      url: 'https://slack.com/api/reactions.add',
      form: {
        channel: channelId,
        name: reaction.emoji,
        timestamp: timestamp,
        token: botToken
      }
    }).on('complete', () =>
      addReactions(channelId, timestamp, reactions.slice(1)));
  }
};

const postQuestion = message => {
  var options = [];
  var question = message.text;
  var reactions = [];
  if (message.text.match(/\[/gi) && message.text.match(/\]/gi)) {
    question = message.text.substr(0, message.text.indexOf('[')).trim();
    const arrayStr = message.text.substr(
      message.text.indexOf('['),
      message.text.indexOf(']'));
    if (arrayStr.length > 2) {
      const textOptions = arrayStr
        .slice(1, -1)
        .split(/\s*,\s*/);
      if (textOptions.length) {
        options = textOptions;
      }
    }
  }

  const formData = {
    channel: message.channel_id,
    icon_emoji: ':question:',
    link_names: 1,
    text: question,
    token: botToken,
    username: message.user_name
  };
  if (options.length) {
    reactions = options.map(option => {
      return {
        emoji: emoji[Math.floor(Math.random() * emoji.length)],
        text: option
      };
    });
    formData.attachments = JSON.stringify([{
      color: 'good',
      fallback: reactions.map(option => option.text)
                         .join(', '),
      text: reactions.map(option => `:${option.emoji}: - ${option.text}`)
                     .join('\n')
    }]);
  }

  request.post({
    url: 'https://slack.com/api/chat.postMessage',
    form: formData
  }, (err, res, body) => {
    if (err || !body) {
      console.log(err);
      return;
    }

    body = JSON.parse(body);
    if (!body.ok) {
      return;
    }

    if (!reactions.length) {
      reactions = [
        {emoji: 'thumbsup'},
        {emoji: 'thumbsdown'}
      ];
    }

    addReactions(body.channel, body.ts, reactions);
  });
};

const getOrgEmoji = () => {
  request.post({
    url: 'https://slack.com/api/emoji.list',
    form: {token: botToken}
  }, (err, res, body) => {
    if (err) {
      console.log(err);
      return;
    } else if (!body) {
      return;
    }

    body = JSON.parse(body);
    if (!body.ok || !body.emoji) {
      return;
    }

    Object.keys(body.emoji).forEach(orgEmoji => {
      if (emoji.indexOf(orgEmoji) === -1) {
        emoji.push(orgEmoji);
      }
    });
  });
};

app.post('/question', (req, res) => {
  res.status(200).end();
  if (req.body && req.body.token === appToken) {
    process.nextTick(() => postQuestion(req.body));
  }
});

app.listen(app.get('port'), () => {
  console.log(`up and running on: ${app.get('port')}`);
});

getOrgEmoji();
