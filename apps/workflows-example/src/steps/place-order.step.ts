import { Order } from '../types/order.js';
import { Customer } from '../types/customer.js';
import { logger } from '../config.js';

export function placeOrderStep(customer: Customer): Order {
  // ...
  // Do fancy invoice creation steps
  // ...
  logger.info('Place order step executing...');

  return {
    amount: 712,
    customerId: customer.customerId,
    reference: `REF-#823923`,
  };
}
