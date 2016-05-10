'use strict';

const http = require('http');
const fetch = require('node-fetch');
const Pubnub = require('pubnub');
const config = require('./config');

const server = http.createServer();
const port = 3069;
const tokensUrl = `${ config.authManagerUrl }/tokens`;
const usersUrl = `${ config.authManagerUrl }/users`;
const pubnub = Pubnub.init({
  publish_key: config.publishKey,
  subscribe_key: config.subscribeKey,
  error: err => {
    console.log('ERROR: Could not connect to Pubnub.', err)
  }
});
let users = [];
let accessToken = '';

// Starting position is approx Union Station Toronto.
const startingPosition = {
  latitude: 43.647424,
  longitude: -79.381077
};
const earthRadius = 6378.1;
const radiansFromDegrees = degrees => (degrees * Math.PI / 180);
const degreesFromRadians = radians => (radians * 180 / Math.PI);
const randomInt = (min, max) => (Math.floor(Math.random() * (max - min)) + min);

const destinationPoint = (position, bearing, distance) => {
  const dist = distance / earthRadius;
  const brng = radiansFromDegrees(bearing);
  const lat1 = radiansFromDegrees(position.latitude);
  const lon1 = radiansFromDegrees(position.longitude);
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(dist) +
                         Math.cos(lat1) * Math.sin(dist) * Math.cos(brng));
  const lon2 = lon1 + Math.atan2(Math.sin(brng) * Math.sin(dist) * Math.cos(lat1),
                                 Math.cos(dist) - Math.sin(lat1) * Math.sin(lat2));

  if (isNaN(lat2) || isNaN(lon2)) return null;

  return {
    latitude: degreesFromRadians(lat2),
    longitude: degreesFromRadians(lon2)
  };
};

// Return a promise to login to auth manager as admin using username/password.
const login = (url, username, password) => (
  fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ username, password })
    })
    .then(res => res.json())
    .then(json => json.accessToken)
    .catch(err => console.log('ERROR: Something went wrong while trying to login.', err))
);

// Return a promise to get a list of all current users from the auth manager.
// Map the default startingPosition values to each user.
const getUsers = (url, token) => (
  fetch(usersUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${ token }`
      }
    })
    .then(res => res.json())
    .then(json => json.users.map(user => Object.assign({}, {
      id: user.id,
      latitude: startingPosition.latitude,
      longitude: startingPosition.longitude
    })))
    .catch(err => console.log('ERROR: Something went wrong while trying to fetch users.', err))
);

// Change users' position based on a random bearing and distance.
// Reference for calculating distance, bearing, and more between lat/long
// points: http://www.movable-type.co.uk/scripts/latlong.html
const updatedUserPositions = users => (
  users.map(user => {
    const currentPosition = {
      latitude: user.latitude,
      longitude: user.longitude
    };
    const newBearing = randomInt(0, 360);
    const newDistance = randomInt(1, 10);
    const newPosition = destinationPoint(currentPosition, newBearing, newDistance);

    return Object.assign({}, user, {
      latitude: newPosition.latitude,
      longitude: newPosition.longitude
    });
  })
);

const publishPubnubMessage = (pubnub, channel) => message => {
  return new Promise((resolve, reject) => {
    pubnub.publish({
      channel,
      message,
      callback: m => resolve(m),
      error: err => reject(err)
    });
  });
};

const subscribeToPubnub = (pubnub, channel) => () => {
  pubnub.subscribe({
    channel,
    message: msg => console.log('Received: ', msg),
    error: err => console.log('Pubnub error: ', err)
  });
};

const publishMessage = publishPubnubMessage(pubnub, config.channel);
const subscribe = subscribeToPubnub(pubnub, config.channel);

// Broadcase all users to PubNub.
const broadcastUserPositions = users => {
  return new Promise((resolve, reject) => {
    users.forEach(user => {
      publishMessage(user)
        .then(msg => console.log('Sent: ', msg))
        .catch(err => reject(err));
    });
    resolve(users);
  });
};

// Every two seconds, update all users' positions to a newly random direction
// and distance from their current position.
const repeatedlyUpdateAndBroadcast = users => {
  setTimeout(() => {
    broadcastUserPositions(updatedUserPositions(users))
      .then(updatedUsers => repeatedlyUpdateAndBroadcast(updatedUsers))
      .catch(err => console.log('ERROR: Could not publish to Pubnub', err));
  }, 2000);
};

login(tokensUrl, config.username, config.password)
  .then(accessToken => getUsers(usersUrl, accessToken))
  .then(users => repeatedlyUpdateAndBroadcast(users))
  .then(() => subscribe())
  .catch(err => console.log('ERROR: Something went wrong.', err));

server.listen(port, () => console.log('Server started on port ', port));
