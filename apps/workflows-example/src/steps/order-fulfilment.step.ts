import { Order } from '../types/order';
import { Invoice } from '../types/invoice';

export function orderFulfilmentStep(order: Order): Invoice {
  // ...
  // Do fancy order fulfilment steps
  // ...

  return {
    invoiceDate: new Date(),
    customerId: order.customerId,
    reference: `REF-#823923`,
  };
}
