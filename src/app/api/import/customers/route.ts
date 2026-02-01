import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { ensureUserAndOrganization } from '@/lib/clerk-sync';
import * as XLSX from 'xlsx';

interface CustomerRow {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  taxExempt?: string | boolean;
  taxExemptionReason?: string;
  taxId?: string;
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

export async function POST(request: NextRequest) {
  try {
    const orgId = await ensureUserAndOrganization();

    if (!orgId) {
      return NextResponse.json(
        { error: 'Unauthorized - Organization required' },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    const fileName = file.name.toLowerCase();
    const isValidFileType =
      fileName.endsWith('.csv') ||
      fileName.endsWith('.xlsx') ||
      fileName.endsWith('.xls');

    if (!isValidFileType) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload a CSV or Excel file.' },
        { status: 400 }
      );
    }

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse file
    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(buffer, { type: 'buffer' });
    } catch (error) {
      return NextResponse.json(
        {
          error:
            'Failed to parse file. Please ensure it is a valid CSV or Excel file.'
        },
        { status: 400 }
      );
    }

    // Get first sheet
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Convert to JSON
    // Use raw: true to preserve data types, then convert to strings
    const rawData = XLSX.utils.sheet_to_json<CustomerRow>(worksheet, {
      raw: false,
      defval: '',
      blankrows: false // Skip blank rows
    });

    if (rawData.length === 0) {
      return NextResponse.json(
        { error: 'File is empty or contains no data' },
        { status: 400 }
      );
    }

    // Normalize column names (handle different header formats)
    const normalizeKey = (key: string): string => {
      const normalized = key.trim().toLowerCase();
      const mappings: Record<string, string> = {
        'customer name': 'name',
        name: 'name',
        customer: 'name',
        email: 'email',
        'email address': 'email',
        phone: 'phone',
        'phone number': 'phone',
        tel: 'phone',
        address: 'address',
        'tax exempt': 'taxExempt',
        taxexempt: 'taxExempt',
        'tax exemption reason': 'taxExemptionReason',
        'exemption reason': 'taxExemptionReason',
        'tax id': 'taxId',
        taxid: 'taxId',
        vat: 'taxId',
        ein: 'taxId'
      };
      return mappings[normalized] || normalized;
    };

    // Normalize data
    const normalizedData = rawData.map((row) => {
      const normalized: any = {};
      Object.keys(row).forEach((key) => {
        const normalizedKey = normalizeKey(key);
        const value = row[key as keyof CustomerRow];
        // Convert all values to strings to handle Excel type issues
        normalized[normalizedKey] =
          value !== null && value !== undefined ? String(value).trim() : '';
      });
      return normalized as CustomerRow;
    });

    // Validate data
    const errors: ValidationError[] = [];
    const validCustomers: Array<{
      name: string;
      email?: string;
      phone?: string;
      address?: string;
      taxExempt: boolean;
      taxExemptionReason?: string;
      taxId?: string;
    }> = [];

    normalizedData.forEach((row, index) => {
      const rowNumber = index + 2; // +2 because index is 0-based and we skip header

      // Skip header rows (rows where name is "Customer Name" or "Name")
      const nameValue = row.name ? String(row.name).trim() : '';
      if (
        nameValue === 'Customer Name' ||
        nameValue === 'Name' ||
        nameValue === ''
      ) {
        return; // Skip this row
      }

      // Validate name (required)
      if (!row.name || String(row.name).trim() === '') {
        errors.push({
          row: rowNumber,
          field: 'name',
          message: 'Name is required'
        });
        return;
      }

      // Validate email (optional, but must be valid if provided)
      let email: string | undefined;
      const emailValue = row.email ? String(row.email).trim() : '';
      // Skip header values
      if (
        emailValue !== '' &&
        emailValue !== 'Email' &&
        emailValue !== 'Email Address'
      ) {
        // More lenient email regex that handles common formats
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(emailValue)) {
          errors.push({
            row: rowNumber,
            field: 'email',
            message: `Invalid email format: "${emailValue}"`
          });
          return;
        }
        email = emailValue;
      }

      // Validate taxExempt (optional, default false)
      let taxExempt = false;
      if (row.taxExempt) {
        const taxExemptValue = String(row.taxExempt).toLowerCase().trim();
        taxExempt = ['true', 'yes', '1', 'y'].includes(taxExemptValue);
      }

      validCustomers.push({
        name: String(row.name).trim(),
        email,
        phone: row.phone ? String(row.phone).trim() : undefined,
        address: row.address ? String(row.address).trim() : undefined,
        taxExempt,
        taxExemptionReason: row.taxExemptionReason
          ? String(row.taxExemptionReason).trim()
          : undefined,
        taxId: row.taxId ? String(row.taxId).trim() : undefined
      });
    });

    // If there are validation errors, return them
    if (errors.length > 0) {
      return NextResponse.json(
        {
          error: 'Validation errors found',
          errors,
          validCount: validCustomers.length,
          errorCount: errors.length
        },
        { status: 400 }
      );
    }

    // Bulk create customers in transaction
    const results = await prisma.$transaction(
      validCustomers.map((customer) =>
        prisma.customer.create({
          data: {
            name: customer.name,
            email: customer.email,
            phone: customer.phone,
            address: customer.address,
            organizationId: orgId,
            ...(customer.taxExempt !== undefined && {
              taxExempt: customer.taxExempt
            }),
            ...(customer.taxExemptionReason && {
              taxExemptionReason: customer.taxExemptionReason
            }),
            ...(customer.taxId && { taxId: customer.taxId })
          } as any
        })
      )
    );

    return NextResponse.json({
      success: true,
      message: `Successfully imported ${results.length} customer(s)`,
      count: results.length
    });
  } catch (error) {
    console.error('Error importing customers:', error);
    return NextResponse.json(
      {
        error: 'Failed to import customers',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
