# Forward Authentication + LDAP Authentication Example

## Purpose

POC to illustrate using Traefik to forward all incoming requests through an auth service which connects to LDAP.

## Attribution

Much of the JS code was taken from:

https://github.com/lucianweber/ldap-jwt/

## Testing

```
npm start

# Succeeds
curl -XPOST http://localhost:3000/auth -H "Content-Type: application/json" --data '{"username":"admin","password":"admin"}'

# Fails
curl -XPOST http://localhost:3000/auth -H "Content-Type: application/json" --data '{"username":"xyz","password":"xyz"}'
```


curl -XPOST "http://auth.localhost/auth" -H "Host:auth.localhost" -H "Content-Type: application/json" --data '{"username":"admin","password":"admin"}'

NOTE: You will have to modify your hosts file to make `auth.localhost` resolve: https://stackoverflow.com/a/51601424/684966


## ToDo
 
* Setup Traefik to route traffic to a 'whoami' service
* Add Forward Auth in Traefik to Auth service
* Auth Service accepts 

## Auth service

Support Basic Auth first?

Auth Request will contain: "X-Forwarded-Uri"

Response: include "X-Forwarded-User"


### Endpoints

https://github.com/lucianweber/ldap-jwt

#### /auth

Request: username, password
Response: Token + Metadata


#### /verify

Includes Header:
`Authorization: Bearer <token>`

Request: token
