basePath = '../';

files = [
  JASMINE,
  JASMINE_ADAPTER,
  'app/public/lib/angular/angular.js',
  'app/public/lib/angular/angular-*.js',
  'app/public/lib/store/store.min.js',
  'test/lib/angular/angular-mocks.js',
  'app/public/js/**/*.js',
  'app/public/js/*.js',
  'test/unit/**/*.js'
];

autoWatch = true;

browsers = ['Chrome'];

junitReporter = {
  outputFile: 'test_out/unit.xml',
  suite: 'unit'
};
