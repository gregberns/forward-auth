//https://github.com/lucianweber/ldap-jwt/blob/master/index.js

var settings = require('./ldap-config.json');

var bodyParser = require('body-parser');
var jwt = require('jwt-simple');
var moment = require('moment');
var LdapAuth = require('ldapauth-fork');
var Promise  = require('promise');

app = require('express')();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(require('cors')());

var auth = new LdapAuth(settings.ldap);

app.set('jwtTokenSecret', settings.jwt.secret);

var authenticate = function (username, password) {
	return new Promise(function (resolve, reject) {
    if (username === "admin") {
      resolve({
        uid: "123",
        cn: "admin",
        mail: "admin@test.com",
      });
    } else {
      reject({
        name: 'InvalidCredentialsError'
      });
    }
    
    // auth.authenticate(username, password, function (err, user) {
		// 	if(err)
		// 		reject(err);
		// 	else if (!user)
		// 		reject();
		// 	else
		// 		resolve(user);
		// });
	});
};

app.get('/health', function (req, res) {
  console.log('health')
  res.json({success: true});
})

app.post('/auth', function (req, res) {
  if(req.body.username && req.body.password) {
		authenticate(req.body.username, req.body.password)
			.then(function(user) {
        var expires = parseInt(moment().add(2, 'days').format("X"));
        
        console.log('user', user)

        var secret = app.get('jwtTokenSecret')

        console.log('secret', secret)

				var token = jwt.encode({
					exp: expires,
					user_name: user.uid,
					full_name: user.cn,
					mail: user.mail
				}, secret);

				res.json({token: token, full_name: user.cn});
			})
			.catch(function (err) {
				// Ldap reconnect config needs to be set to true to reliably
				// land in this catch when the connection to the ldap server goes away.
				// REF: https://github.com/vesse/node-ldapauth-fork/issues/23#issuecomment-154487871

				console.log(err);

				if (err.name === 'InvalidCredentialsError' || (typeof err === 'string' && err.match(/no such user/i)) ) {
					res.status(401).send({ error: 'Wrong user or password'});
				} else {
					// ldapauth-fork or underlying connections may be in an unusable state.
					// Reconnect option does re-establish the connections, but will not
					// re-bind. Create a new instance of LdapAuth.
					// REF: https://github.com/vesse/node-ldapauth-fork/issues/23
					// REF: https://github.com/mcavage/node-ldapjs/issues/318

					res.status(500).send({ error: 'Unexpected Error'});
					auth = new LdapAuth(settings.ldap);
				}

			});
		} else {
			res.status(400).send({error: 'No username or password supplied'});
		}
})

var port = (process.env.PORT || 3000);
app.listen(port, function() {
	console.log('Listening on port: ' + port);

	if (typeof settings.ldap.reconnect === 'undefined' || settings.ldap.reconnect === null || settings.ldap.reconnect === false) {
		console.warn('WARN: This service may become unresponsive when ldap reconnect is not configured.')
	}
});
