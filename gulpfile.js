'use strict';

const gulp = require('gulp');
const nodemon = require('gulp-nodemon');
const argv = require('yargs').argv;

// Optionally pass a --delay flag (in seconds) to set the broadcast delay.
// Default is 2 seconds.
gulp.task('server', function () {
  nodemon({
    script: 'index.js',
    nodeArgs: ['--harmony_destructuring'],
    ext: 'js html',
    env: {
      'NODE_ENV': 'development',
      'DELAY': (argv.delay * 1000) || 2000
    }
  });
});

gulp.task('default', gulp.series('server'));
