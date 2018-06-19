require('should');

const zapier = require('zapier-platform-core');

const App = require('../index');
const appTester = zapier.createAppTester(App);

describe('Authentication', () => {

  it('should get token', (done) => {
	zapier.tools.env.inject();
    const bundle = {
      authData: {
	client_id: process.env.CLIENT_ID,
	client_secret: process.env.CLIENT_SECRET,
      },
    };

    appTester(App.authentication.oauth2Config.getAccessToken, bundle)
      .then((result) => {
        result.should.have.property('access_token');
        result.should.have.property('refresh_token');
        done();
      })
      .catch(done);
  });

  it('should generate an authorize URL', (done) => {
	zapier.tools.env.inject();
    const bundle = {
      // When an app runs on zapier.com, these will be generated by Zapier and
      // passed to your app in the bundle. For the purpose of this test, we
      // create a bundle with dummy values to ensure our function works.
      inputData: {
	redirect_uri: 'https://zapier.com/dashboard/auth/oauth/return/App4771CLIAPI/',
	state: 'oauth2',
	},
      environment: {
        CLIENT_ID: process.env.CLIENT_ID,
        CLIENT_SECRET: process.env.CLIENT_SECRET,
      },
    };

    appTester(App.authentication.oauth2Config.authorizeUrl, bundle)
      .then((authorizeUrl) => {
        authorizeUrl.should.eql('https://platformdev.cloud.coveo.com/oauth/authorize?response_type=code&redirect_uri=https%3A%2F%2Fzapier.com%2Fdashboard%2Fauth%2Foauth%2Freturn%2FApp4771CLIAPI%2F&realm=Platform&client_id=test_id&scope=full&state=oauth2');
	done();
      })
      .catch(done);
  });
});
