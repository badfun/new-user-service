import * as cdk from '@aws-cdk/core';
import * as codebuild from '@aws-cdk/aws-codebuild';
import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as codepipeline_actions from '@aws-cdk/aws-codepipeline-actions';
import * as codecommit from '@aws-cdk/aws-codecommit';

import { CodeBuildAction, CodeCommitSourceAction, ManualApprovalAction } from '@aws-cdk/aws-codepipeline-actions';
import { Bucket, BucketEncryption } from '@aws-cdk/aws-s3';

export class PipelineStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const serviceName = 'new-user';

    // Pipeline artifacts bucket
    const pipelineArtifactBucket = new Bucket(this, 'CiCdPipelineArtifacts', {
      bucketName: serviceName + '-pipeline-artifacts',
      encryption: BucketEncryption.S3_MANAGED
    });
    
    const appArtifactBucket = new Bucket(this, 'AppArtifacts', {
      bucketName: serviceName + '-app-artifacts',
      encryption: BucketEncryption.S3_MANAGED
    })

    const repository = new codecommit.Repository(this, serviceName, {
      repositoryName: serviceName,
    });

    // Source
    const sourceArtifacts = new codepipeline.Artifact();
    const sourceAction: CodeCommitSourceAction = new codepipeline_actions.CodeCommitSourceAction({
      actionName: 'Repository',
      repository,
      output: sourceArtifacts,
      branch: 'master',
      trigger: codepipeline_actions.CodeCommitTrigger.EVENTS,
      variablesNamespace: 'SourceVariables'
    });
    
    // Build
    const buildProject = new codebuild.PipelineProject(this, 'CiCdBuild', {
      buildSpec: codebuild.BuildSpec.fromSourceFilename('pipeline/buildspec.json'),
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_3_0
      },
      projectName: serviceName + '-app-build'
    });

    appArtifactBucket.grantPut(buildProject);

    const buildArtifacts = new codepipeline.Artifact();
    const buildAction: CodeBuildAction = new codepipeline_actions.CodeBuildAction({
      actionName: 'Build',
      input: sourceArtifacts,
      environmentVariables: {
        S3_BUCKET: {value: appArtifactBucket.bucketName},
        GIT_BRANCH: {value: sourceAction.variables.branchName}
      },
      project: buildProject,
      variablesNamespace: 'BuildVariables',
      outputs: [buildArtifacts]
    });
    
    // Test
    const testProject = new codebuild.PipelineProject(this, 'CiCdTest', {
      buildSpec: codebuild.BuildSpec.fromSourceFilename('pipeline/buildspec-test.json'),
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_3_0,
        privileged: true
      },
      projectName: serviceName + '-app-test'
    });

    const testAction: CodeBuildAction = new codepipeline_actions.CodeBuildAction({
      actionName: 'Test',
      input: sourceArtifacts,
      environmentVariables: {
        E2E_TEST: {value: 'true'}
      },
      project: testProject
    });

    // Deploy
    const deployProject = new codebuild.PipelineProject(this, 'CiCdDeploy', {
      buildSpec: codebuild.BuildSpec.fromSourceFilename('pipeline/buildspec-deploy.json'),
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_3_0
      },
      projectName: serviceName + '-app-deploy'
    });

    appArtifactBucket.grantRead(deployProject);
    deployProject.role?.addManagedPolicy({managedPolicyArn: 'arn:aws:iam::aws:policy/AWSCloudFormationFullAccess'});
    deployProject.role?.addManagedPolicy({managedPolicyArn: 'arn:aws:iam::aws:policy/AWSLambdaFullAccess'});
    deployProject.role?.addManagedPolicy({managedPolicyArn: 'arn:aws:iam::aws:policy/IAMFullAccess'});
    deployProject.role?.addManagedPolicy({managedPolicyArn: 'arn:aws:iam::aws:policy/AWSCodeDeployFullAccess'});
    deployProject.role?.addManagedPolicy({managedPolicyArn: 'arn:aws:iam::aws:policy/AmazonS3FullAccess'});
    deployProject.role?.addManagedPolicy({managedPolicyArn: 'arn:aws:iam::aws:policy/AmazonSNSFullAccess'});
    // required for Cognito
    deployProject.role?.addManagedPolicy({managedPolicyArn: 'arn:aws:iam::aws:policy/AdministratorAccess'});

    // Deploy to staging
    const deployToStagingAction: CodeBuildAction = new codepipeline_actions.CodeBuildAction({
      actionName: 'Deploy',
      input: sourceArtifacts,
      environmentVariables: {
        STACK_NAME: {value: serviceName + '-app-staging'},
        ENVIRONMENT: {value: 'staging'},
        ARTIFACTS_PATH: {value: buildAction.variable('ARTIFACTS_PATH')}
      },
      project: deployProject
    });

    // Deploy to Production
    const manualApprovalAction: ManualApprovalAction = new codepipeline_actions.ManualApprovalAction({
      actionName: 'Review',
      additionalInformation: 'Ensure function works properly in Staging',
      runOrder: 1
    });

    const deployToProductionAction: CodeBuildAction = new codepipeline_actions.CodeBuildAction({
      actionName: 'Deploy',
      input: sourceArtifacts,
      environmentVariables: {
        STACK_NAME: {value: serviceName + '-app-production'},
        ENVIRONMENT: {value: 'production'},
        ARTIFACTS_PATH: {value: buildAction.variable('ARTIFACTS_PATH')}
      },
      project: deployProject,
      runOrder: 2
    });

    // Pipeline
    new codepipeline.Pipeline(this, 'CiCdPipeline', {
      pipelineName: serviceName,
      artifactBucket: pipelineArtifactBucket,
      stages: [
        {
          stageName: 'Source',
          actions: [sourceAction],
        }, {
          stageName: 'Build',
          actions: [buildAction]
        }, {
          stageName: 'Test',
          actions: [testAction]
        }, {
          stageName: 'Deploy-to-Staging',
          actions: [deployToStagingAction]
        },{
        stageName: 'Deploy-to-Production',
        actions: [manualApprovalAction, deployToProductionAction]
        }
      ]
    });
  }
}
