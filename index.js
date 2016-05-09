'use strict';

const express = require('express');
const fetch = require('node-fetch');
const config = require('./config');

const tokensUrl = `${ config.authManagerUrl }/tokens`;
const usersUrl = `${ config.authManagerUrl }/users`;
let users = [];
let accessToken = '';

const app = express();

app.set('port', process.env.PORT || 3069);

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

// Broadcase all users to PubNub.
const broadcastUserPositions = users => {
  console.log(users[0]);
};

// Every two seconds, update all users' positions to a newly random direction
// and distance from their current position.
const repeatedlyUpdateAndBroadcast = users => {
  setTimeout(() => {
    const updatedUsers = updatedUserPositions(users);
    broadcastUserPositions(updatedUsers);
    repeatedlyUpdateAndBroadcast(updatedUsers);
  }, 2000);
};

login(tokensUrl, config.username, config.password)
  .then(accessToken => getUsers(usersUrl, accessToken))
  .then(users => repeatedlyUpdateAndBroadcast(users))
  .catch(err => console.log('ERROR: Something went wrong.', err));

const server = app.listen(app.get('port'), function () {
  console.log(`Server started at port ${ server.address().port }`);
});
