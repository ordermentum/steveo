import { Step } from 'steveo/src/types/workflow-step';
import { Invoice } from '../types/invoice';
import { Customer } from '../types/customer';
import { Workflow } from 'steveo/src/workflow';

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


