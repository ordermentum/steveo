import { Middleware } from "../common";


export class WorkflowMiddleware implements Middleware {

  consume(context, next): () => void {
    return () => next();
  }

  publish(context, next): () => void {
    return () => next();
  }

  postConsume(context, result, next): () => void {
    const workflowId = context._meta.workflowId;
    const workflowStep = context._meta.workflowStepId;

    if (result.error) {
      workflow.rollback(workflowStep, result.error);
    } else {
      workflow.progress(workflowStep, result.value);
    }

    return () => next();
  }
}

// @ts-expect-error not definning everyhting
const steveo = new Steveo({
  middleware: [new WorkflowMiddleware()]
});

