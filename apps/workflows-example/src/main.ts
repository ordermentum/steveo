import { WorkflowPayload } from '@steveo/steveo';
import { logger, steveo } from './config';
import { createInvoiceStep } from './steps/order-fulfilment.step';
import { placeOrderStep } from './steps/place-order.step';
import { Customer } from './types/customer';

(async () => {

  // We are going to create a fictitious workflow that follows
  // the creation of an order through to payment being taken
  const flow = steveo
    .flow('order-e2e-flow')
    .next({
      trigger: 'placer-order-step',
      execute: placeOrderStep
    })
    .next({
      trigger: 'create-invoice-step',
      execute: createInvoiceStep
    });


  const customer: Customer & WorkflowPayload = {
    workflowId: undefined,
    customerId: 'cust-123',
    firstName: 'mr',
    lastName: 'tester'
  };

  // Manual trigger for testing
  flow.execute(customer).catch(ex => {
    logger.debug('Exception', ex);
    process.exit();
  });

})();
