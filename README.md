# Forward Authentication + LDAP Authentication Example

## Purpose

Exploring ways to configure authentication in a microservices architecture. Specifically, using a reverse proxy to ensure all incoming application requests contain valid authentication tokens.

## Contents of Repo

Simple set of services to illustrate:

* Auth requests are forwarded to an auth server, which authenticates request and returns an auth token
* API requests have a valid auth header token before being forwarded to an application server

This example uses [Traefik](http://traefik.io) as the front end to route auth requests to the auth server and API requests to the application server, first checking for a valid token.

## Request Flow

There are two parts to the request flow. 

First, a user authenticates with the auth endpoint (port 79 in the examples below). If successful a JWT token is returned. 

Second, the client sends a request to the Application endpoint (port 80 in the examples below), including the JWT token. Assuming the token is valid, the request will be forwarded to the application server and the server will respond accordingly.

**Request Auth Token**

* Make request to Auth endpoint, with credentials
* Reverse Proxy forwards to Auth Server
* Auth server validates or rejects credentials
* Reverse Proxy returns Auth response

**Use Auth Token**

* Make request to Application with Auth Token
* Reverse Proxy forwards request to Auth Server
* Auth server validates or rejects token
* Reverse Proxy forwards successful auth requests to Application Server, returns failed auth response to client
* Application server processes requests, returns response
* Reverse Proxy returns application response

![Authentication Sequence](./docs/AuthenticationSequence.png)

## Attribution and Resources

* [Intro to JWT](https://jwt.io/introduction/)
* [How to deal with JWT expiration?](https://gist.github.com/soulmachine/b368ce7292ddd7f91c15accccc02b8df)
* [Much of the JS code was taken from here, so thanks lucianweber](https://github.com/lucianweber/ldap-jwt/)

## Additional Research

* Configure LDAP authentication
* Handle JWT Expiration
* Token Management (https://gist.github.com/soulmachine/b368ce7292ddd7f91c15accccc02b8df)
  * 'Extend' a token
  * Revoke token
* Look at "authorization code flow"
  * https://openid.net/connect/
  * https://openid.net/specs/openid-connect-core-1_0.html#CodeFlowAuth
* Redirect HTTP traffic to HTTPS
  * Allow dev workflow without HTTPS

## Concerns

* Ensure Auth server is:
  * Robust and Secure
  * Libraries do not have vulnerabilities
* How to prevent/monitor for suspicious activity
* JWT Token Secret will need to be available on all application servers for validating tokens
  * Or use Public/Private keys, where only Auth server has private and application servers have public keys

## Example Requests

### Requesting Auth Token

Successful because a valid user is submitted

```bash
$ curl -i -XPOST http://auth.localhost:79/auth -H "Content-Type: application/json" --data '{"username":"admin","password":"admin"}'

HTTP/1.1 200 OK
Access-Control-Allow-Origin: *
Content-Length: 220
Content-Type: application/json; charset=utf-8
Date: Thu, 11 Apr 2019 05:08:26 GMT
Etag: W/"dc-1OswAAqvSp+9c383tJMUIYAJC7Q"
{"token":"eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJleHAiOjE1NTUxMzIxMDYsInVzZXJfbmFtZSI6IjEyMyIsImZ1bGxfbmFtZSI6ImFkbWluIiwibWFpbCI6ImFkbWluQHRlc3QuY29tIn0.cEDeu_nPhvu2CII5KPs9whVQDdgg-mda6oODqHhV_0A","full_name":"admin"}
```

Fails because invalid user

```bash
$ curl -i -XPOST http://auth.localhost:79/auth -H "Content-Type: application/json" --data '{"username":"xyz","password":"xyz"}'

HTTP/1.1 401 Unauthorized
Access-Control-Allow-Origin: *
Content-Length: 34
Content-Type: application/json; charset=utf-8
Date: Thu, 11 Apr 2019 05:09:22 GMT
Etag: W/"22-ncTfOqjqE5Y+QT19LuTai8LvWBM"

{"error":"Wrong user or password"}
```

### Complete Workflow

Request an auth token, then make a request using the token.

This example uses [jq](https://stedolan.github.io/jq/download/) to parse the JSON to extract the token.

```bash
# Request new auth token
curl -XPOST http://auth.localhost:79/auth -H "Content-Type: application/json" --data '{"username":"admin","password":"admin"}' |\
# Extract 'token'
jq '.token' |\
# Remove `"` from start and end of string
cut -d "\"" -f 2 |\
# make request to service with token
curl http://whoami.localhost/ -H "Authorization: Bearer $(cat -)"
```


### API Request

```bash
curl -XPOST "http://auth.localhost/auth" -H "Host:auth.localhost" -H "Content-Type: application/json" --data '{"username":"admin","password":"admin"}'
```

NOTE: You may have to modify your hosts file to make `auth.localhost` resolve: https://stackoverflow.com/a/51601424/684966


Will return a 401 Unauthorized

```bash
curl -i -XGET "http://whoami.localhost/"

HTTP/1.1 401 Unauthorized
Access-Control-Allow-Origin: *
Content-Length: 0
Date: Thu, 11 Apr 2019 05:12:18 GMT
```

```bash
curl -i -XGET "http://whoami.localhost/" -H "Authorization: Bearer ABC"

HTTP/1.1 200 OK
Content-Length: 17
Content-Type: text/plain; charset=utf-8
Date: Thu, 11 Apr 2019 05:12:39 GMT

I'm 7421448eb4c0
```

## Tests

### Missing Auth Header

```bash
curl -i -XGET http://whoami.localhost/

HTTP/1.1 400 Bad Request
Access-Control-Allow-Origin: *
Content-Type: application/json; charset=utf-8
Content-Length: 43
ETag: W/"2b-JpYRGD0cbj9/XPwi3ve83p8GieM"
Date: Thu, 11 Apr 2019 05:32:03 GMT
Connection: keep-alive

{"error":"Authorization Header is missing"}
```

### Auth header missing 'Bearer' type

```bash
curl -i -XGET http://whoami.localhost/ -H "Authorization: asdf"

HTTP/1.1 400 Bad Request
Access-Control-Allow-Origin: *
Content-Type: application/json; charset=utf-8
Content-Length: 62
ETag: W/"3e-/HIoBOKCUWqjQ9holacN5/rZamk"
Date: Thu, 11 Apr 2019 05:32:30 GMT
Connection: keep-alive

{"error":"Authorization Header does not contain Bearer token"}
```

### Auth Token missing

```bash
curl -i http://whoami.localhost/ -H "Authorization: Bearer"

HTTP/1.1 400 Bad Request
Access-Control-Allow-Origin: *
Content-Type: application/json; charset=utf-8
Content-Length: 56
ETag: W/"38-y9E61ZfxQiWq9FNtvC85AVSYjdE"
Date: Thu, 11 Apr 2019 05:42:19 GMT
Connection: keep-alive

{"error":"Authorization Header Access token is missing"}
```

### Access token error

```bash
curl -i http://whoami.localhost/ -H "Authorization: Bearer ABC"

HTTP/1.1 400 Bad Request
Access-Control-Allow-Origin: *
Content-Type: application/json; charset=utf-8
Content-Length: 55
ETag: W/"37-Nkl0CLHEHIZxW8w78ZY79pLWZQE"
Date: Thu, 11 Apr 2019 05:46:44 GMT
Connection: keep-alive

{"error":"Invalid Access Token. Could not be decoded."}
```
