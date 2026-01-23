# Database Migrations

This directory contains all database migrations for the Open Invoice application.

## Migration History

Migrations are applied in chronological order based on their timestamp prefix.

### Core Schema Setup

1. **`20260121210719_init`** - Initial database schema
   - Creates core tables: customers, products, invoices, invoice_items, payments
   - Sets up basic invoice management structure

2. **`20260121164820_add_user_and_organization_models`** - Multi-tenant foundation
   - Adds users, organizations, and organization_members tables
   - Enables Clerk-based authentication and multi-tenant support

### Organization Scoping

3. **`20260121220000_add_organization_to_invoices_customers_products`** - Add organization scoping
   - Adds `organizationId` columns to customers, products, and invoices
   - Creates foreign key relationships to organizations
   - Enables organization-based data filtering

4. **`20260121214450_add_product_image_url`** - Product images
   - Adds `imageUrl` field to products table

5. **`20260121230000_add_share_token_to_invoice`** - Public invoice sharing
   - Adds `shareToken` field to enable public invoice access

6. **`20250122120000_make_organization_required`** - Enforce data isolation
   - Makes `organizationId` required (NOT NULL) for all business entities
   - Clears legacy data without organizationId
   - **WARNING**: This migration deletes all existing data

## Running Migrations

### Development
```bash
npx prisma migrate dev
```

### Production
```bash
npx prisma migrate deploy
```

### Reset Database (Development only)
```bash
npx prisma migrate reset
```

## Important Notes

- **Data Loss**: The `make_organization_required` migration will delete all existing invoices, customers, and products
- **Organization Required**: All new records must have an `organizationId` after the final migration
- **Multi-Tenant**: The application is designed for multi-tenant use with organization-based data isolation

## Migration Best Practices

1. Always test migrations in development first
2. Backup production data before running migrations
3. Review migration SQL before applying
4. Never modify existing migrations that have been applied to production

