copper heart
============
Copper Heart is an experiment. 

Copper Heart gives us a way to receive monthly contributions 
from our friends, in the form of credit card payments, while
conveying where the contributions are going, and promoting a
dialog between the people receiving contributions and those 
providing them.

The main idea is to make a place where the meaning behind our money 
is brought to the forefront, and the numbers are an afterthought.

audience
---------
The current audience of Copper Heart is self-employed computer 
programmers, or friends of computer programmers, who want a neat 
funding platform and are willing to hack around to get things to
work for the time being.

The potential audience of Copper Heart is the self-employed, 
community-backed creators and volunteers of the world.

development state
------------------
Dear programmers, 

This project is entering rough draft territory. That is, a few ideas
are in place, implemented in a narrow but not blind fashion, with 
minimal error checking.

To become a fully realized rough draft, unit tests need to have 
their say, and reporting (errors and analytics) needs to be a thing.

end game
-----------
The second version of Copper Heart will be complete when:
* The setup process for installing it on your server is straight-forward and simple.
* Ideas gathered from conversations around the first version have their say.

getting started
-----------------
Copper Heart uses Node.js, CouchDB, Redis, and Stripe. To begin:

    1. Open an account on Stripe.com
    2. Set up a Node, CouchDB, and Redis server (e.g. Nodejitsu)
    3. Install Graphics Magick for development (Nodejitsu provides this)

configuration
-----------------
You'll need to configure five components: 

    1. Stripe
    2. CouchDB
    3. Redis
    4. Accounts / authorization
    5. Google Analytics (optional)

Configuration is done via environment variables.

### Stripe

+ `STRIPE_PUBLIC_TEST` Your public test key (i.e. pk_test_...)
+ `STRIPE_API_TEST` Your *secret* test key (i.e. sk_test_...)
+ `STRIPE_PUBLIC_LIVE` Your public live key (i.e. pk_live_...)
+ `STRIPE_API_LIVE` Your *secret* live key (i.e. sk_live_...)
+ `STRIPE_CONNECT_CLIENT_ID` Your Stripe Connect id (i.e. ca_...)

### CouchDB

+ `DB_NAME` (stores patron and member data)
+ `DB_STATIC_NAME` (stores images)
+ `DB_HOST` (i.e. localhost)
+ `DB_PORT`
+ `DB_USE_HTTPS` true or false
+ `DB_USERNAME` optional
+ `DB_PASSWORD` optional

### Redis

Redis is only used in production.

+ `REDIS_HOST` (i.e. name.redis.irstack.com)
+ `REDIS_PORT`
+ `REDIS_PASSWORD`

### Member setup

Copper Heart uses OpenID through Google for authentication.

+ `MEMBER_EMAIL_ADDRESSES` comma-separated list of Google-account emails of people who can receive money
+ `ENTRANCE_USERNAMES` comma-separated list of usernames of people on the front page

### Google Analytics

+ `ANALYTICS_DOMAIN` (e.g. mydomain.org)
+ `ANALYTICS_ID` (i.e. UA-12345678-1)

### Misc

+ `NODE_ENV` production or development

CouchDB configuration
----------------------
+ Create the main and static databases.
+ Add users to your CouchDB instance. 
+ Assign the "app" role to your database user. 
+ Grant the "app" role "admin" permissions on the static database. 
+ Grant your database user "admin" and "member" permissions on the main database.

It's a minor goal to have the code take care of this in the future.

authors
-------
Phil Manijak <<github@exclsr.com>>
