import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

export async function GET(request: NextRequest) {
  try {
    // Create template data with headers and example row
    const templateData = [
      {
        name: 'Customer Name',
        email: 'Email',
        phone: 'Phone',
        address: 'Address',
        'taxExempt (true/false)': 'Tax Exempt',
        'taxExemptionReason (optional)': 'Tax Exemption Reason',
        taxId: 'Tax ID'
      },
      {
        name: 'John Doe',
        email: 'john.doe@gmail.com',
        phone: '+1-555-123-4567',
        address: '123 Main St, City, State, ZIP',
        'taxExempt (true/false)': 'false',
        'taxExemptionReason (optional)': '',
        taxId: ''
      }
    ];

    // Create workbook and worksheet
    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Customers');

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
          'attachment; filename="customers-import-template.xlsx"'
      }
    });
  } catch (error) {
    console.error('Error generating customers template:', error);
    return NextResponse.json(
      { error: 'Failed to generate template' },
      { status: 500 }
    );
  }
}
