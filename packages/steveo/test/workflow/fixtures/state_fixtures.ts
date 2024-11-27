import sinon from 'sinon';
import { StepUnknown } from '../../../src/types/workflow-step';

type FactoryStep = {
  step: StepUnknown;
  fake: sinon.SinonSpy<any[], any>;
};

interface WorkflowFixtures {
  stepReturn: (name: string, value: string) => FactoryStep;
  stepThrow: (name: string, error: string) => FactoryStep;
}

function stepReturn(name: string, value: string): FactoryStep {
  const fake = sinon.fake.returns({ value });
  const step: StepUnknown = {
    name,
    execute: fake,
  } as StepUnknown;

  return { step, fake };
}

function stepThrow(
  name: string,
  error = 'Expected testing error'
): FactoryStep {
  const fake = sinon.fake.throws(error);
  const step: StepUnknown = {
    name,
    execute: fake,
  };

  return { step, fake };
}

export const fixtures: WorkflowFixtures = {
  stepReturn,
  stepThrow,
};
