# Forward Authentication Example

## Purpose

Exploring ways to configure authentication in a microservices architecture. Specifically, using a reverse proxy to ensure all incoming application requests contain valid authentication tokens.

## Technology

* Reverse Proxy: Traefik v2.1
* Identity Provider: KeyCloak
* Forward auth service: written in Node.JS

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

## To Do

* Forward on particular headers from the token

## Run It

* Start the service

```
docker-compose up
```

* Configure KeyCloak (the Identity Provider)
  * Go to `http://localhost/auth`
  * Open KeyCloak Admin console
  * Log in with `admin` `password`
  * Configure a client
    * Go to "Configure" > "Clients" on the left panel
    * Select "Create", to create a new client
    * In the "Client ID" field, enter `client1`
    * In "Client Protocol", select `openid-connect`
    * Click "Save"
    * Change "Access Type" to "public" ('public' means that a client_secret doesn't need to be supplied)
    * In "Valid Redirect URIs", enter `http://localhost`
    * Click "Save"
  * Configure a user
    * Go to "Manage" > "Users" on the left panel
    * Select "Add User"
    * In `Username` field, enter "user1"
    * Click "Save"
    * Select the "Credentials" selection header
    * In the "New Password" and "Password Confirmation" fields, enter `password`
    * Turn "Temporary" to "Off"
    * Click "Reset Password"

* Get Auth Token Cert
  * Go to "Configure" > "Realm Settings" on the left panel
  * Select "Keys" from header menu
  * In the "RS256" row, click the "Certificate" button
  * Copy the cert
  * In the project's file structure, go to `./auth-svc-data/jwt-secret.txt`
  * Replace line 2 with the cert copied from KeyCloak
  * Save the file

* Execute Requests
  * Request an auth token with a client called `client` and a user `user1` with password `password`
  * Call `svc1`s `/health` endpoint, passing in the `access_token`

```bash
curl -XPOST -d "grant_type=password&username=user1&password=password&client_id=client1" http://localhost/auth/realms/master/protocol/openid-connect/token |\
jq '.access_token' |\
cut -d "\"" -f 2 |\
curl -i http://localhost/svc1/secure -H "Authorization: Bearer $(cat -)"
```

## Example Requests

This will get an auth token, assuming there is a client called `client` and a user `user1` with password `password`:

```bash
curl -i -XPOST -d "grant_type=password&username=user1&password=password&client_id=client1" http://localhost/auth/realms/master/protocol/openid-connect/token
```

This will make the request to the service. Traefik will pass the auth token to the auth service to verify the token, and the request will be forwarded to the internal service.

```bash
curl -i http://localhost/svc1/secure -H "Authorization: Bearer $(AUTH_TOKEN)"
```

In one fell swoop.

This example uses [jq](https://stedolan.github.io/jq/download/) to parse the JSON to extract the token.

```bash
curl -XPOST -d "grant_type=password&username=user1&password=password&client_id=client1" http://localhost/auth/realms/master/protocol/openid-connect/token |\
jq '.access_token' |\
cut -d "\"" -f 2 |\
curl -i http://localhost/svc1/secure -H "Authorization: Bearer $(cat -)"
```

### API Request

Will return a 401 Unauthorized

```bash
curl -i -XGET "http://localhost/svc1/secure"

HTTP/1.1 401 Unauthorized
Access-Control-Allow-Origin: *
Content-Length: 0
Date: Thu, 11 Apr 2019 05:12:18 GMT
```

```bash
curl -i -XGET "http://localhost/svc1/secure" -H "Authorization: Bearer ABC"

HTTP/1.1 200 OK
Content-Length: 16
Content-Type: text/plain; charset=utf-8
Date: Thu, 11 Apr 2019 05:12:39 GMT

{"success":true}
```

## Tests

### Missing Auth Header

```bash
curl -i -XGET http://localhost/svc1/secure

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
curl -i -XGET http://localhost/svc1/secure -H "Authorization: asdf"

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
curl -i http://localhost/svc1/secure -H "Authorization: Bearer"

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
curl -i http://localhost/svc1/secure -H "Authorization: Bearer ABC"

HTTP/1.1 400 Bad Request
Access-Control-Allow-Origin: *
Content-Type: application/json; charset=utf-8
Content-Length: 55
ETag: W/"37-Nkl0CLHEHIZxW8w78ZY79pLWZQE"
Date: Thu, 11 Apr 2019 05:46:44 GMT
Connection: keep-alive

{"error":"Invalid Access Token. Could not be decoded."}
```
