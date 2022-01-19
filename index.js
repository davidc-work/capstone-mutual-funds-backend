import crypto from 'crypto';
import AWS from 'aws-sdk';
import express from 'express';
import bodyParser from 'body-parser';
import https from 'https';
import cors from 'cors';

const app = express();
app.use(cors({
  origin: '*'
}));

var jsonParser = bodyParser.json();
const port = process.env.PORT || 5280;

function encrypt(text) {
    var cipher = crypto.createCipher('aes256', 'password');
    return cipher.update(text, 'utf8', 'hex') + cipher.final('hex');
}

function decrypt(text) {
    var decipher = crypto.createDecipher('aes256', 'password');
    return decipher.update(text, 'hex', 'utf8') + decipher.final('utf8');
}

var aivonpeaamk = '2bc1429da10de25ab39ef4cd4887c1b996c903577fe69a0f88c54525306fa11a';
var ixiujewkssfdewu = 'daa135a85bbcf3df8db2446142bb53a0b0f1872aae1a3af98323cb66a05596deb4c57c87ed7ad1bd68002cb0b699a5a1';

var lkzojewmkl = decrypt(aivonpeaamk);
var iocjowmklew = decrypt(ixiujewkssfdewu);

let awsConfig = {
    region: 'us-east-1',
    endpoint: 'http://dynamodb.us-east-1.amazonaws.com',
    accessKeyId: lkzojewmkl,
    secretAccessKey: iocjowmklew
}
AWS.config.update(awsConfig);

let docClient = new AWS.DynamoDB.DocumentClient();

function generateRowId(shardId = 4) {
  var ts = 512 * (shardId + 64 * (new Date().getTime() - 1300000000000));
  var randid = Math.floor(Math.random() * 512);

  return ts + randid;
}

function getAll(table, callback) {
  var params = {
    TableName: table
  }

  docClient.scan(params, (err, data) => {
    if (err) callback(err, undefined);
    else callback(undefined, data);
  });
}

let _funds = [], _users = [], _stocks = [];

function getStocks(callback) {
  const options = {
    hostname: 'stockapiaddresshere.com',
    path: '/',
    method: 'GET'
  }

  const request = https.request(options, response => {
    response.on('data', data => callback(data));
  });

  request.on('error', err => callback(err));
}

function update() {
  getAll('capstone_mutual_funds', (err, data) => {
    if (err) console.error(err);
    else _funds = data.Items;
  });

  getAll('capstone_mutual_funds_users', (err, data) => {
    if (err) console.error(err);
    else _users = data.Items;
  });

  getStocks(data => _stocks = data);
}

update();
setInterval(update, 10000);

app.get('/', (req, res) => res.send(''));

app.get('/funds', (req, res) => res.send(_funds));

app.get('/funds/:id', (req, res) => res.send(_funds.find(i => i.id == req.params.id)));

app.get('/user-funds', (req, res) => res.send(_users));

app.get('/user-funds/:id', (req, res) => {
  var fund_ids = _users.filter(u => u.user_id == req.params.id).map(u => u.fund_id);
  res.send(fund_ids.map(id => {
    const r = _funds.find(f => f.id == id);
    return r ? {
      fund_id: id,
      name: r.fund_name,
      price: r.price,
      stocks: []
    } : {
      fund_id: id,
      err: 'does not exist'
    };
  }).sort((a, b) => a.fund_id - b.fund_id));
});

app.delete('/user-funds/:id', (req, res) => {
  var rows = _users.filter(i => i.user_id == req.params.id);
  if (!rows.length) return res.send('id invalid');
  var items = rows.map(r => ({
    DeleteRequest: {
      Key: {
        id: r.id
      }
    }
  }));

  const params = {
    RequestItems: {
      'capstone_mutual_funds_users' : items
    }
  }

  docClient.batchWrite(params, (err, data) => {
    if (err) res.send(err);
    else res.send(data);

    update();
  });
});

app.delete('/user-funds/:user_id/:fund_id', (req, res) => {
  const { user_id, fund_id } = req.params;

  var row = _users.find(u => u.user_id == user_id && u.fund_id == fund_id);
  if (row) {
    var params = {
      TableName: 'capstone_mutual_funds_users',
      Key: {
        id: row.id
      }
    }

    docClient.delete(params, (err, data) => {
      if (err) res.send(err);
      else res.send(data);

      update();
    });
  } else res.send('invalid user or fund id');
});

app.post('/user-funds', jsonParser, (req, res) => {
  console.log(req.body);
  const body = req.body;

  if (_users.find(u => u.user_id == body.user_id && u.fund_id == body.fund_id)) 
    return res.send({
      err: 'User ' + body.user_id + ' already has fund ' + body.fund_id
    });

  const input = {
    id: generateRowId(),
    user_id: body.user_id,
    fund_id: body.fund_id
  }

  const params = {
    TableName: 'capstone_mutual_funds_users',
    Item: input
  }

  docClient.put(params, (err, data) => {
    if (err) console.error(err);
    else res.send('success');

    update();
  });
});

app.listen(port, () => {
  console.log(`Listening at port ${port}`);
});