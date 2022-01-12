import crypto from 'crypto';
import AWS from 'aws-sdk';
import express from 'express';
import bodyParser from 'body-parser';
import https from 'https';

const app = express();
var jsonParser = bodyParser.json();
const port = process.env.PORT || 3000;

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

var CUSTOMEPOCH = 1300000000000;
function generateRowId(shardId = 4) {
  var ts = new Date().getTime() - CUSTOMEPOCH;
  var randid = Math.floor(Math.random() * 512);
  ts = (ts * 64);
  ts = ts + shardId;
  return (ts * 512) + randid;
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

app.get('/', (req, res) => {
  res.send('');
});

app.get('/funds', (req, res) => {
  getAll('capstone_mutual_funds', (err, data) => {
    if (err) res.send(err);
    else res.send(data.Items);
  });
});

app.get('/funds/:id', (req, res) => {
  const id = req.params.id;

  getAll('capstone_mutual_funds', (err, data) => {
    if (err) res.send(err);
    else res.send(data.Items.find(i => i.id == id));
  });
});

app.get('/get-stocks/:id', (req, res) => {
  const options = {
    hostname: 'stockapiaddresshere.com',
    path: '/mutual-funds/' + req.params.id,
    method: 'GET'
  }

  const request = https.request(options, response => {
    response.on('data', data => res.send(data));
  });

  request.on('error', err => res.send(data));
});

app.get('/user-funds', (req, res) => {
  getAll('capstone_mutual_funds_users', (err, data) => {
    if (err) res.send(err);
    else res.send(data.Items);
  });
});

app.get('/user-funds/:id', (req, res) => {
  const id = req.params.id;

  getAll('capstone_mutual_funds_users', (err, data) => {
    if (err) res.send(err);
    else {
      var fund_ids = data.Items.filter(i => i.user_id == id || i.username == id)
        .map(i => i.fund_id);
      getAll('capstone_mutual_funds', (err, data) => {
        if (err) res.send(err);
        else {
          res.send(fund_ids.map(n => {
            const r = data.Items.find(i => i.id == n);
            return r ? {
              name: r.fund_name,
              price: r.price,
              stocks: []
            } : undefined;
          }));
        }
      });
      
    }
  });
});

app.delete('/user-funds/:id', (req, res) => {
  const id = req.params.id;

  getAll('capstone_mutual_funds_users', (err, data) => {
    if (err) res.send(err);
    else {
      var rows = data.Items.filter(i => i.user_id == id);
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
      });
    }
  });
});

app.delete('/user-funds/:user_id/:fund_id', (req, res) => {
  const { user_id, fund_id } = req.params;

  getAll('capstone_mutual_funds_users', (err, data) => {
    if (err) res.send(err);
    else {
      var rows = data.Items.filter(i => i.user_id == user_id && i.fund_id == fund_id);
      if (!rows.length) return res.send('user and/or fund id invalid');
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
      });
    }
  });
});

app.post('/user-funds', jsonParser, (req, res) => {
  console.log(req.body);
  const body = req.body;
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
  });
});

app.listen(port, () => {
  console.log(`Listening at port ${port}`);
});