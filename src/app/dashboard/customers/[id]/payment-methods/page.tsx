'use client';

import { useParams } from 'next/navigation';
import { CustomerPaymentMethods } from '@/features/invoicing/components/customer-payment-methods';

export default function CustomerPaymentMethodsPage() {
  const params = useParams();
  const id = params?.id as string;

  return (
    <div className='space-y-6 p-6'>
      <CustomerPaymentMethods customerId={id} />
    </div>
  );
}
