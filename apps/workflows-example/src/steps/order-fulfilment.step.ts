import { Order } from '../types/order';
import { Invoice } from '../types/invoice';

export function createInvoiceStep(order: Order): Invoice {
  // ...
  // Do fancy invoice creation steps
  // ...

  return {
    invoiceDate: new Date(),
    customerId: order.customerId,
    reference: `REF-#823923`,
  };
}
