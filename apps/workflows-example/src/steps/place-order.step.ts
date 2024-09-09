import { Invoice } from '../types/invoice';
import { Customer } from '../types/customer';

export function placeOrderStep(customer: Customer): Invoice {

  // ...
  // Do fancy invoice creation steps
  // ...

  return {
    invoiceDate: new Date(),
    customerId: customer.customerId,
    reference: `REF-#823923`
  };
}


