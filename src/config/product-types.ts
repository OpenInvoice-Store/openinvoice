/**
 * Product type configurations
 * Defines which variant attributes are available for each product type
 */

export type ProductVariantAttribute = {
  name: string;
  type: 'text' | 'select' | 'number';
  label: string;
  required?: boolean;
  options?: string[]; // For select type
  placeholder?: string;
};

export type ProductTypeConfig = {
  id: string;
  name: string;
  label: string;
  icon?: string;
  variants: ProductVariantAttribute[];
};

export const PRODUCT_TYPES: ProductTypeConfig[] = [
  {
    id: 'generic',
    name: 'generic',
    label: 'Generic Product',
    variants: []
  },
  {
    id: 'shoe',
    name: 'shoe',
    label: 'Shoe',
    variants: [
      {
        name: 'size',
        type: 'select',
        label: 'Size',
        required: false,
        options: [
          '5',
          '5.5',
          '6',
          '6.5',
          '7',
          '7.5',
          '8',
          '8.5',
          '9',
          '9.5',
          '10',
          '10.5',
          '11',
          '11.5',
          '12',
          '12.5',
          '13',
          '14',
          '15'
        ]
      },
      {
        name: 'color',
        type: 'text',
        label: 'Color',
        required: false,
        placeholder: 'e.g., Black, White, Red'
      },
      {
        name: 'width',
        type: 'select',
        label: 'Width',
        required: false,
        options: ['Narrow', 'Medium', 'Wide', 'Extra Wide']
      },
      {
        name: 'material',
        type: 'text',
        label: 'Material',
        required: false,
        placeholder: 'e.g., Leather, Canvas, Mesh'
      }
    ]
  },
  {
    id: 'tshirt',
    name: 'tshirt',
    label: 'T-Shirt',
    variants: [
      {
        name: 'size',
        type: 'select',
        label: 'Size',
        required: false,
        options: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']
      },
      {
        name: 'color',
        type: 'text',
        label: 'Color',
        required: false,
        placeholder: 'e.g., Black, White, Navy Blue'
      },
      {
        name: 'material',
        type: 'text',
        label: 'Material',
        required: false,
        placeholder: 'e.g., Cotton, Polyester, Blend'
      },
      {
        name: 'fit',
        type: 'select',
        label: 'Fit',
        required: false,
        options: ['Slim', 'Regular', 'Relaxed', 'Oversized']
      }
    ]
  },
  {
    id: 'clothing',
    name: 'clothing',
    label: 'Clothing',
    variants: [
      {
        name: 'size',
        type: 'select',
        label: 'Size',
        required: false,
        options: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']
      },
      {
        name: 'color',
        type: 'text',
        label: 'Color',
        required: false,
        placeholder: 'e.g., Black, White, Navy Blue'
      },
      {
        name: 'material',
        type: 'text',
        label: 'Material',
        required: false,
        placeholder: 'e.g., Cotton, Polyester, Wool'
      }
    ]
  },
  {
    id: 'electronics',
    name: 'electronics',
    label: 'Electronics',
    variants: [
      {
        name: 'model',
        type: 'text',
        label: 'Model',
        required: false,
        placeholder: 'e.g., iPhone 15 Pro, Samsung Galaxy S24'
      },
      {
        name: 'color',
        type: 'text',
        label: 'Color',
        required: false,
        placeholder: 'e.g., Space Gray, Silver, Gold'
      },
      {
        name: 'storage',
        type: 'select',
        label: 'Storage',
        required: false,
        options: ['64GB', '128GB', '256GB', '512GB', '1TB', '2TB']
      }
    ]
  },
  {
    id: 'furniture',
    name: 'furniture',
    label: 'Furniture',
    variants: [
      {
        name: 'color',
        type: 'text',
        label: 'Color/Finish',
        required: false,
        placeholder: 'e.g., Walnut, Oak, Black, White'
      },
      {
        name: 'dimensions',
        type: 'text',
        label: 'Dimensions',
        required: false,
        placeholder: 'e.g., 60" x 30" x 30"'
      },
      {
        name: 'material',
        type: 'text',
        label: 'Material',
        required: false,
        placeholder: 'e.g., Wood, Metal, Glass'
      }
    ]
  },
  {
    id: 'book',
    name: 'book',
    label: 'Book',
    variants: [
      {
        name: 'format',
        type: 'select',
        label: 'Format',
        required: false,
        options: ['Hardcover', 'Paperback', 'eBook', 'Audiobook']
      },
      {
        name: 'language',
        type: 'text',
        label: 'Language',
        required: false,
        placeholder: 'e.g., English, Spanish, French'
      },
      {
        name: 'isbn',
        type: 'text',
        label: 'ISBN',
        required: false,
        placeholder: 'e.g., 978-0-123456-78-9'
      }
    ]
  }
];

export function getProductTypeConfig(
  typeId: string
): ProductTypeConfig | undefined {
  return PRODUCT_TYPES.find((type) => type.id === typeId);
}

export function getProductTypeConfigByName(
  name: string
): ProductTypeConfig | undefined {
  return PRODUCT_TYPES.find((type) => type.name === name);
}
