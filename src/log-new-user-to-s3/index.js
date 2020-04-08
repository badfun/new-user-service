const S3 = require('aws-sdk/clients/s3');
const s3 = new S3({ apiVersion: '2006-03-01' });
const bucketName = process.env.BUCKET_NAME

/**
 * Handler
 */
exports.handler = (event) => {
    console.log('Received event:', JSON.stringify(event));

    if (event.request.userAttributes["cognito:user_status"] === "CONFIRMED") {

        let id = 'user_' + event.request.userAttributes.sub;

        return uploadUserData(event, id);

    } else {
        console.log('The user has not been confirmed');
        return event;
    }
};

/**
 * Upload user data to S3 bucket
 * 
 * @param {*} event 
 * @param {*} id 
 */
async function uploadUserData(event, id) {
    const params = {
        Bucket: bucketName,
        Key: id + ".json",
        Body: JSON.stringify(event)
    };

    try {
        await s3.putObject(params).promise();
        console.log('User data succesfully logged to S3 bucket');
        return event;
    } catch (err) {
        console.log(err);
        return err;
    }
}