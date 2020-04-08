const chai = require('chai');
const sinon = require('sinon');
const sinonChai = require('sinon-chai');
const proxyquire = require('proxyquire');

const expect = chai.expect;
chai.use(sinonChai);

describe('log user data to S3 tests', () => {
    let handler;
    let s3stub;
    let sandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();

        s3stub = {
            putObject: sandbox.stub().returns({ promise: () => Promise.resolve() })
        };

        const mockAws = { S3: sandbox.stub().returns(s3stub) };

        handler = proxyquire('../../index', {
            'aws-sdk/clients/s3': mockAws.S3
        }).handler;
    });

    it('should log a new user to s3', async () => {

        // Arrange
        const event = {
            "request": {
                "userAttributes": {
                    "custom:organization": "Unit Test Inc.",
                    "sub": "16e5bf8d-93ee-4e09-8480-689b20d6a7a6",
                    "cognito:user_status": "CONFIRMED",
                    "email_verified": "false",
                    "email": "test@unittest.com"
                }
            },
            "response": {}
        }

        let id = 'user_' + event.request.userAttributes.sub;

        // Act
        await handler(event);

        // Assert
        expect(s3stub.putObject).to.have.been.calledWith({
            Bucket: 'new-user-service-test-bucket',
            Key: 'user_16e5bf8d-93ee-4e09-8480-689b20d6a7a6.json',
            Body: JSON.stringify(event)
        });
    });

    afterEach(() => sandbox.restore());

});