const aws = require('aws-sdk');
const codedeploy = new aws.CodeDeploy({ apiVersion: '2014-10-06' });
const lambdaClient = new aws.Lambda();
const s3Client = new aws.S3({ apiVersion: '2006-03-01' });
const bucketName = process.env.BUCKET_NAME;

exports.handler = async (event, context, callback) => {

  console.log("Entering PreTraffic Hook!");
  console.log(JSON.stringify(event));

  //Read the DeploymentId from the event payload.
  let deploymentId = event.DeploymentId;
  console.log("deploymentId=" + deploymentId);

  //Read the LifecycleEventHookExecutionId from the event payload
  let lifecycleEventHookExecutionId = event.LifecycleEventHookExecutionId;
  console.log("lifecycleEventHookExecutionId=" + lifecycleEventHookExecutionId);

  /*
    [Perform validation or prewarming steps here]
  */

  const functionToTest = process.env.FN_NEW_VERSION;
  console.log('Testing new function version: ' + functionToTest);

  const newUserData = {
    "version": "1",
    "region": "us-west-2",
    "userPoolId": "us-west-2_dUhgFQkW4",
    "userName": "Tester",
    "callerContext": {
      "awsSdkVersion": "aws-sdk-unknown-unknown",
      "clientId": null
    },
    "triggerSource": "PostConfirmation_ConfirmSignUp",
    "request":
    {
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

  let id = 'user_' + newUserData.request.userAttributes.sub;
  const lambdaParams = {
    FunctionName: functionToTest,
    InvocationType: 'Event',
    Payload: JSON.stringify(newUserData)
  }

  await lambdaClient.invoke(lambdaParams).promise();

  const s3Params = {
    Bucket: bucketName,
    Key: id + ".json",
    Body: JSON.stringify(newUserData)
  }

  console.log('S3 putObject params', s3Params);
  await wait();
  const data = await s3Client.putObject(s3Params).promise();
  console.log('S3 item', JSON.stringify(data, null, 2));

  if (!data) {
    throw new Error('UserData not logged to S3');
  }

  delete s3Params.Body;
  await s3Client.deleteObject(s3Params).promise();
  console.log('Test S3 object deleted');

  // Prepare the validation test results with the deploymentId and
  // the lifecycleEventHookExecutionId for AWS CodeDeploy.
  let params = {
    deploymentId: deploymentId,
    lifecycleEventHookExecutionId: lifecycleEventHookExecutionId,
    status: 'Succeeded' // status can be 'Succeeded' or 'Failed'
  };

  try {
    await codedeploy.putLifecycleEventHookExecutionStatus(params).promise();
    console.log("putLifecycleEventHookExecutionStatus done. executionStatus=[" + params.status + "]");
    return 'Validation test succeeded'
  }
  catch (err) {
    console.log("putLifecycleEventHookExecutionStatus ERROR: " + err);
    throw new Error('Validation test failed')
  }

}

function wait(ms) {
  ms = ms || 1500;
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}