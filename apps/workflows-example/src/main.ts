import { steveo } from './config';
import {
  createInvoiceStep,
  rollbackInvoiceStep,
} from './steps/create-invoice.step';
import { placeOrderStep } from './steps/place-order.step';
import { Customer } from './types/customer';

(async () => {
  // We are going to create a fictitious workflow that follows
  // the creation of an order through to payment being taken
  const flow = steveo
    .flow('order-e2e-flow', {
      serviceId: 'ordermentum-api',
      waitToCommit: false,
    })
    .next({
      topic: 'extremely-verbose-topic-name-for-testing-purposes',
      name: 'placer-order-step',
      execute: placeOrderStep,
      queueName: 'hello-queue',
      waitToCommit: false,
      fifo: false,
      deadLetterQueue: true,
    })
    .next({
      name: 'create-invoice-step',
      execute: createInvoiceStep,
      rollback: rollbackInvoiceStep,
    });

  await flow.publish({});

  const customer: Customer = {
    customerId: 'cust-123',
    firstName: 'mr',
    lastName: 'tester',
  };

  await steveo.publish(flow.name, customer);

  const runner = steveo.runner();

  await runner.createQueues();
  await runner.process();
})();
