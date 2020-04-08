const chai = require('chai');
const expect = chai.expect;

const sdk = require('aws-sdk');

const s3Options = {
  apiVersion: '2012-10-17',
  endpoint: new sdk.Endpoint('http://localhost:4572')
};
const s3Client = new sdk.S3(s3Options);

const handler = require('../../index').handler;

describe('log new user to s3 tests', () => {

  it('should log a new user to an s3 bucket', async () => {
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
    const s3Params = {
      Bucket: process.env.BUCKET_NAME,
      Key: id + '.json',
      Body: JSON.stringify(event)
    }

    const { Item } = await s3Client.putObject(s3Params).promise();
    console.log(Item);
    expect(Item).not.to.be.undefined;
  });

})