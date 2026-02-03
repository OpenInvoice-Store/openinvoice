'use client';

import { useEffect } from 'react';

export default function InvoiceLayout({
  children
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    // Enable scrolling for invoice pages by overriding body overflow
    document.body.style.overflow = 'auto';

    return () => {
      // Restore original overflow when leaving the page
      document.body.style.overflow = '';
    };
  }, []);

  return <>{children}</>;
}
