import { Order } from '../types/order';
import { Customer } from '../types/customer';

export function placeOrderStep(customer: Customer): Order {

  // ...
  // Do fancy invoice creation steps
  // ...

  return {
    amount: 712,
    customerId: customer.customerId,
    reference: `REF-#823923`
  };
}


