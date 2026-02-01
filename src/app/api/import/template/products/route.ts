import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

export async function GET(request: NextRequest) {
  try {
    // Create template data with headers and example row
    const templateData = [
      {
        name: 'Product Name',
        description: 'Description',
        price: 'Price',
        'taxRate (%)': 'Tax Rate (%)',
        unit: 'Unit',
        imageUrl: 'Image URL'
      },
      {
        name: 'Example Product',
        description: 'This is an example product description',
        price: '99.99',
        'taxRate (%)': '10',
        unit: 'piece',
        imageUrl: 'https://example.com/image.jpg'
      }
    ];

    // Create workbook and worksheet
    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');

    // Generate buffer
    const buffer = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx'
    });

    return new NextResponse(buffer, {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition':
          'attachment; filename="products-import-template.xlsx"'
      }
    });
  } catch (error) {
    console.error('Error generating products template:', error);
    return NextResponse.json(
      { error: 'Failed to generate template' },
      { status: 500 }
    );
  }
}
