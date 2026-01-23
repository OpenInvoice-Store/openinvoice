import PageContainer from '@/components/layout/page-container';
import { ProductForm } from '@/features/invoicing/components/product-form';

export const metadata = {
  title: 'Dashboard: Edit Product'
};

export default function EditProductPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <PageContainer
      pageTitle='Edit Product'
      pageDescription='Update product information'
    >
      <ProductForm />
    </PageContainer>
  );
}

