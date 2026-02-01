import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { ensureUserAndOrganization } from '@/lib/clerk-sync';
import * as XLSX from 'xlsx';

interface ProductRow {
  name?: string;
  description?: string;
  price?: string | number;
  taxRate?: string | number;
  unit?: string;
  imageUrl?: string;
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
    // Use raw: false to convert to strings, blankrows: false to skip blank rows
    const rawData = XLSX.utils.sheet_to_json<ProductRow>(worksheet, {
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
        'product name': 'name',
        name: 'name',
        product: 'name',
        description: 'description',
        desc: 'description',
        price: 'price',
        cost: 'price',
        'tax rate (%)': 'taxRate',
        'tax rate': 'taxRate',
        tax: 'taxRate',
        unit: 'unit',
        'image url': 'imageUrl',
        image: 'imageUrl',
        imageurl: 'imageUrl'
      };
      return mappings[normalized] || normalized;
    };

    // Normalize data
    const normalizedData = rawData.map((row) => {
      const normalized: any = {};
      Object.keys(row).forEach((key) => {
        const normalizedKey = normalizeKey(key);
        const value = row[key as keyof ProductRow];
        // Convert all values to strings to handle Excel type issues
        normalized[normalizedKey] =
          value !== null && value !== undefined ? String(value).trim() : '';
      });
      return normalized as ProductRow;
    });

    // Validate data
    const errors: ValidationError[] = [];
    const validProducts: Array<{
      name: string;
      description?: string;
      price: number;
      taxRate: number;
      unit: string;
      imageUrl?: string;
    }> = [];

    normalizedData.forEach((row, index) => {
      const rowNumber = index + 2; // +2 because index is 0-based and we skip header

      // Skip header rows (rows where name is "Product Name" or "Name")
      const nameValue = row.name ? String(row.name).trim() : '';
      if (
        nameValue === 'Product Name' ||
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

      // Validate price (required)
      const priceValue = row.price ? String(row.price).trim() : '';
      // Skip header values
      if (priceValue === 'Price' || priceValue === '') {
        errors.push({
          row: rowNumber,
          field: 'price',
          message: 'Price is required'
        });
        return;
      }

      const price = parseFloat(priceValue.replace(/[^0-9.-]/g, ''));
      if (isNaN(price) || price < 0) {
        errors.push({
          row: rowNumber,
          field: 'price',
          message: `Valid price is required (must be a number >= 0). Received: "${priceValue}"`
        });
        return;
      }

      // Validate taxRate (optional, default 0)
      let taxRate = 0;
      if (row.taxRate) {
        const parsedTaxRate = parseFloat(
          String(row.taxRate).replace(/[^0-9.-]/g, '')
        );
        if (!isNaN(parsedTaxRate)) {
          if (parsedTaxRate < 0 || parsedTaxRate > 100) {
            errors.push({
              row: rowNumber,
              field: 'taxRate',
              message: 'Tax rate must be between 0 and 100'
            });
            return;
          }
          taxRate = parsedTaxRate;
        }
      }

      // Validate unit (optional, default 'piece')
      const unit = row.unit ? String(row.unit).trim() : 'piece';
      if (unit === '') {
        errors.push({
          row: rowNumber,
          field: 'unit',
          message: 'Unit cannot be empty'
        });
        return;
      }

      validProducts.push({
        name: String(row.name).trim(),
        description: row.description
          ? String(row.description).trim()
          : undefined,
        price,
        taxRate,
        unit,
        imageUrl: row.imageUrl ? String(row.imageUrl).trim() : undefined
      });
    });

    // If there are validation errors, return them
    if (errors.length > 0) {
      return NextResponse.json(
        {
          error: 'Validation errors found',
          errors,
          validCount: validProducts.length,
          errorCount: errors.length
        },
        { status: 400 }
      );
    }

    // Bulk create products in transaction
    const results = await prisma.$transaction(
      validProducts.map((product) =>
        prisma.product.create({
          data: {
            name: product.name,
            description: product.description,
            price: product.price,
            taxRate: product.taxRate,
            unit: product.unit,
            ...(product.imageUrl && { imageUrl: product.imageUrl }),
            organizationId: orgId
          } as any
        })
      )
    );

    return NextResponse.json({
      success: true,
      message: `Successfully imported ${results.length} product(s)`,
      count: results.length
    });
  } catch (error) {
    console.error('Error importing products:', error);
    return NextResponse.json(
      {
        error: 'Failed to import products',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
