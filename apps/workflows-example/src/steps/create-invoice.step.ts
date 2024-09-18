import { Order } from '../types/order';
import { Invoice } from '../types/invoice';
import { logger } from '../config';

export function createInvoiceStep(order: Order): Invoice {
  // ...
  // Do fancy invoice creation steps
  // ...
  logger.info('Create invoice step executing...');

  return {
    invoiceDate: new Date(),
    customerId: order.customerId,
    reference: `INV-823923`,
  };
}

export function rollbackInvoiceStep() {
  logger.info('Executing ROLLBACK for create invoice step');
}
