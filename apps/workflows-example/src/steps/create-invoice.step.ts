import { Step } from 'steveo/src/types/workflow-step';
import { Order } from '../types/order';
import { Invoice } from '../types/invoice';


export const createInvoiceStep: Step<Order, Invoice> = {

  trigger: 'create-invoice-step',

  execute: (payload: Order) => {

    // ...
    // Do fancy invoice creation steps
    // ...

    return {
      invoiceDate: new Date(),
      customerId: payload.customerId,
      reference: `REF-#823923`
    };
  }
}



