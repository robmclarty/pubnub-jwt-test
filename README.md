# Pubnub JWT Tester

This is just a simple node server that I made to test using Pubnub. It pulls
data from a JWT authenticated resource server that has a list of users. This
isn't actually that important since I'm only using the IDs from those
resources here. The important thing is that it appends location data (i.e.,
latitude and longitude) and then randomly moves each user and broadcasts the
changes to Pubnub, which could then be listened to by another application (e.g.,
possibly an app that plots these positions on a map).

## Usage

`gulp server --delay 2`

Set the delay between each publish action (default is 2 seconds).

Requires an array of users with `id` attributes. Currently it is setup to
authenticate with a server on localhost:3000, but you could just replace that
code and inject whatever data you like into the `users` array, as long as those
elements are objects that have an `id` attribute to pull from.
