//https://github.com/lucianweber/ldap-jwt/blob/master/index.js

var fs = require('fs');
var bodyParser = require('body-parser');
var jwt = require('jwt-simple');
var moment = require('moment');
var Promise = require('promise');

app = require('express')();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(require('cors')());
app.disable('x-powered-by');

console.log(`JWT_SECRET_PATH=${process.env.JWT_SECRET_PATH}`)
if (process.env.JWT_SECRET_PATH == undefined || process.env.JWT_SECRET_PATH == null || process.env.JWT_SECRET_PATH == "") {
    console.error("JWT_SECRET_PATH environment variable not found.")
    throw new Error("JWT_SECRET_PATH environment variable not found.")
}

var jwtTokenSecret = fs.readFileSync(process.env.JWT_SECRET_PATH, 'utf8');
app.set('jwtTokenSecret', jwtTokenSecret);
console.log(`jwtTokenSecret set. Token length: ${jwtTokenSecret.length}, Token: ${jwtTokenSecret}`)

// https://www.keycloak.org/docs/latest/securing_apps/#_certificate_endpoint
// http://localhost/auth/realms/master/protocol/openid-connect/certs

app.get('/health', function (req, res) {
    console.log('health')
    res.json({ success: true });
})

app.get('/verify', function (req, res) {
    console.log('/verify called')
    console.log('AuthHeader', req.headers.authorization)

    if (!req.headers.authorization) {
        res.status(400).send({ error: 'Authorization Header is missing' });
        return;
    }

    const [bearer, token] = req.headers.authorization.split(' ');
    // req.headers.authorization.split(' ')[0]
    if (bearer !== 'Bearer') {
        res.status(400).send({ error: 'Authorization Header does not contain Bearer token' });
        return;
    }

    if (!token) {
        res.status(400).send({ error: 'Authorization Header Access token is missing' });
        return;
    }

    var decoded = null;
    let jwtTokenSecret = app.get('jwtTokenSecret');
    console.log(`token: ${token}`)
    try {
        decoded = jwt.decode(token, jwtTokenSecret);
    } catch (err) {
        console.error('Invalid Access Token. Could not be decoded.', token, err);
        res.status(400).send({ error: 'Invalid Access Token. Could not be decoded.' });
        return;
    }

    if (decoded.exp <= parseInt(moment().format("X"))) {
        console.log(`Response: 400. Expired token.`)
        res.status(400).send({ error: 'Access token has expired' });
    } else {
        console.log(`Response: 200`)
        res.status(200).send();
    }

});

var port = (process.env.PORT || 3000);
app.listen(port, function () {
    console.log('Listening on port: ' + port);
});
