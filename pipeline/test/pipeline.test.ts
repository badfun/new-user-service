import Pipeline = require('../lib/pipeline-stack');
import { Stack } from '@aws-cdk/core';
import { SynthUtils, MatchStyle } from '@aws-cdk/assert';

// snapshot test
test('Pipeline stack matches template', () => {
  const stack = new Stack();

  new Pipeline.PipelineStack(stack, 'Pipeline');
  expect(SynthUtils.toCloudFormation(stack)).toMatchSnapshot();
});
