var gulp = require('gulp');

var inline = require('gulp-inline'); // used to inline files
var stripDebug = require('gulp-strip-debug'); // strip logs and dead code
var uglify = require('gulp-uglify'); // minify the code
var rename = require('gulp-rename'); // rename the minified code

// Piping all of the vendor css and js we need, explicitly stated for fine control.

gulp.task('dev-vendor', function() {
    gulp.src('bower_components/angular/*.min.*').pipe(gulp.dest('vendor'));
});

// inlining all of the components
gulp.task('inline', function() {
    gulp.src('index.html')
        .pipe(inline({
            base: './'
        }))
        .pipe(gulp.dest('deploy'));

    console.log('---- inline done');
});

gulp.task('minify',function() {
    gulp.src('rallyconnector.js')
        .pipe(stripDebug())
        .pipe(uglify())
        .pipe(rename('rallyconnector.min.js'))
        .pipe(gulp.dest('./'));

    console.log('Minified - ',new Date().getUTCSeconds());
});

gulp.task('watch',function() {
    gulp.watch('rallyconnector.js',['minify']);
});

gulp.task('default', ['inline']);