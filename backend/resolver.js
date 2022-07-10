const { join } = require('path');

module.exports = (path, options) => {
  // A quick fix for the import resolver bug in resolve.exports which jest uses
  if (path === 'aws-cdk-lib/.warnings.jsii.js') {
    return join(
      __dirname,
      '..',
      'node_modules',
      'aws-cdk-lib',
      '.warnings.jsii.js',
    );
  }

  return options.defaultResolver(path, options);
};
