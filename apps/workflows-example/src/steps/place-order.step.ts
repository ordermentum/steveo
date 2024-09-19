import { Order } from '../types/order';
import { Customer } from '../types/customer';
import { logger } from '../config';

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
