'use strict';

const gulp = require('gulp');
const nodemon = require('gulp-nodemon');

gulp.task('server', function () {
  nodemon({
    script: 'index.js',
    nodeArgs: ['--harmony_destructuring'],
    ext: 'js html',
    env: { 'NODE_ENV': 'development' }
  });
});

gulp.task('default', gulp.series('server'));
