import PageContainer from '@/components/layout/page-container';
import { ProductForm } from '@/features/invoicing/components/product-form';

export const metadata = {
  title: 'Dashboard: New Product'
};

export default function NewProductPage() {
  return (
    <PageContainer
      pageTitle='New Product'
      pageDescription='Add a new product or service'
    >
      <ProductForm />
    </PageContainer>
  );
}

