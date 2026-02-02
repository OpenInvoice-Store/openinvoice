import { prisma } from './db';

export type AIProvider = 'openai' | 'gemini';

export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
}

export interface AIGenerateTextOptions {
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  imageUrl?: string; // For vision models
}

export interface AIGenerateTextResponse {
  text: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

/**
 * Get AI configuration for an organization
 */
export async function getAIConfig(
  organizationId: string
): Promise<AIConfig | null> {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId }
  });

  if (!organization) {
    return null;
  }

  // Using type assertion since Prisma types may not be updated yet
  const org = organization as any;

  if (!org.aiEnabled || !org.aiProvider) {
    return null;
  }

  const apiKey =
    org.aiProvider === 'openai' ? org.openaiApiKey : org.geminiApiKey;

  if (!apiKey) {
    return null;
  }

  return {
    provider: org.aiProvider as AIProvider,
    apiKey
  };
}

/**
 * Generate text using OpenAI
 */
async function generateWithOpenAI(
  apiKey: string,
  options: AIGenerateTextOptions
): Promise<AIGenerateTextResponse> {
  try {
    const { OpenAI } = await import('openai');

    const client = new OpenAI({
      apiKey
    });

    const messages: Array<{ role: 'system' | 'user'; content: any }> = [];

    if (options.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }

    // If image URL is provided, use vision model
    if (options.imageUrl) {
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: options.prompt },
          {
            type: 'image_url',
            image_url: { url: options.imageUrl }
          }
        ]
      });

      const response = await client.chat.completions.create({
        model: 'gpt-4o-mini', // Supports vision
        messages: messages as any,
        max_tokens: options.maxTokens || 1000,
        temperature: options.temperature || 0.7
      });

      const text = response.choices[0]?.message?.content || '';

      return {
        text,
        usage: {
          promptTokens: response.usage?.prompt_tokens,
          completionTokens: response.usage?.completion_tokens,
          totalTokens: response.usage?.total_tokens
        }
      };
    }

    // Text-only generation
    messages.push({ role: 'user', content: options.prompt });

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages as any,
      max_tokens: options.maxTokens || 1000,
      temperature: options.temperature || 0.7
    });

    const text = response.choices[0]?.message?.content || '';

    return {
      text,
      usage: {
        promptTokens: response.usage?.prompt_tokens,
        completionTokens: response.usage?.completion_tokens,
        totalTokens: response.usage?.total_tokens
      }
    };
  } catch (error: any) {
    if (error.message?.includes('API key')) {
      throw new Error(
        'Invalid OpenAI API key. Please check your API key in settings.'
      );
    }
    throw error;
  }
}

/**
 * Generate text using Google Gemini
 */
async function generateWithGemini(
  apiKey: string,
  options: AIGenerateTextOptions
): Promise<AIGenerateTextResponse> {
  try {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    let fullPrompt = options.prompt;
    if (options.systemPrompt) {
      fullPrompt = `${options.systemPrompt}\n\n${options.prompt}`;
    }

    // If image URL is provided, use vision capabilities
    if (options.imageUrl) {
      // Fetch image and convert to base64
      const imageResponse = await fetch(options.imageUrl);
      const imageBuffer = await imageResponse.arrayBuffer();
      const imageBase64 = Buffer.from(imageBuffer).toString('base64');
      const mimeType =
        imageResponse.headers.get('content-type') || 'image/jpeg';

      const result = await model.generateContent({
        contents: [
          {
            role: 'user',
            parts: [
              { text: fullPrompt },
              {
                inlineData: {
                  data: imageBase64,
                  mimeType
                }
              }
            ]
          }
        ],
        generationConfig: {
          maxOutputTokens: options.maxTokens || 1000,
          temperature: options.temperature || 0.7
        }
      });

      const response = await result.response;
      const text = response.text();

      return {
        text,
        usage: {
          totalTokens: response.usageMetadata?.totalTokenCount
        }
      };
    }

    // Text-only generation
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
      generationConfig: {
        maxOutputTokens: options.maxTokens || 1000,
        temperature: options.temperature || 0.7
      }
    });

    const response = await result.response;
    const text = response.text();

    return {
      text,
      usage: {
        // Gemini doesn't provide detailed token usage in the same way
        totalTokens: response.usageMetadata?.totalTokenCount
      }
    };
  } catch (error: any) {
    if (
      error.message?.includes('API key') ||
      error.message?.includes('API_KEY')
    ) {
      throw new Error(
        'Invalid Gemini API key. Please check your API key in settings.'
      );
    }
    throw error;
  }
}

/**
 * Generate text using the configured AI provider
 */
export async function generateText(
  organizationId: string,
  options: AIGenerateTextOptions
): Promise<AIGenerateTextResponse> {
  const config = await getAIConfig(organizationId);

  if (!config) {
    throw new Error(
      'AI is not configured or enabled for this organization. Please configure AI settings.'
    );
  }

  switch (config.provider) {
    case 'openai':
      return generateWithOpenAI(config.apiKey, options);
    case 'gemini':
      return generateWithGemini(config.apiKey, options);
    default:
      throw new Error(`Unsupported AI provider: ${config.provider}`);
  }
}

/**
 * Generate invoice item description
 */
export async function generateInvoiceDescription(
  organizationId: string,
  productName: string,
  context?: {
    customerName?: string;
    previousDescriptions?: string[];
  }
): Promise<string> {
  const systemPrompt = `You are a professional invoice description generator. Generate clear, concise, and professional descriptions for invoice line items. Descriptions should be:
- Professional and business-appropriate
- Clear and specific
- Concise (1-2 sentences maximum)
- Relevant to the product or service`;

  let prompt = `Generate a professional invoice description for the following product/service: "${productName}"`;

  if (context?.customerName) {
    prompt += `\nCustomer: ${context.customerName}`;
  }

  if (
    context?.previousDescriptions &&
    context.previousDescriptions.length > 0
  ) {
    prompt += `\n\nPrevious descriptions used for this customer:\n${context.previousDescriptions
      .slice(-3)
      .map((d, i) => `${i + 1}. ${d}`)
      .join('\n')}\n\nMaintain consistency with the style above.`;
  }

  prompt += '\n\nReturn only the description text, nothing else.';

  const response = await generateText(organizationId, {
    prompt,
    systemPrompt,
    maxTokens: 150,
    temperature: 0.7
  });

  return response.text.trim();
}

/**
 * Generate smart product suggestions based on customer history
 */
export async function suggestProducts(
  organizationId: string,
  customerId: string,
  limit: number = 5
): Promise<Array<{ productId: string; name: string; reason: string }>> {
  // Get customer's invoice history
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      invoices: {
        include: {
          items: {
            include: {
              product: true
            }
          }
        },
        orderBy: {
          createdAt: 'desc'
        },
        take: 10
      }
    }
  });

  if (!customer) {
    return [];
  }

  // Get all products for the organization
  const products = await prisma.product.findMany({
    where: { organizationId },
    select: {
      id: true,
      name: true,
      description: true,
      price: true
    }
  });

  // Analyze customer history
  const productFrequency: Record<string, number> = {};
  customer.invoices.forEach((invoice) => {
    invoice.items.forEach((item) => {
      productFrequency[item.productId] =
        (productFrequency[item.productId] || 0) + 1;
    });
  });

  // Sort products by frequency
  const sortedProducts = products
    .map((product) => ({
      ...product,
      frequency: productFrequency[product.id] || 0
    }))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, limit);

  // Use AI to generate reasons for suggestions
  const config = await getAIConfig(organizationId);
  if (config) {
    try {
      const productNames = sortedProducts.map((p) => p.name).join(', ');
      const prompt = `Customer "${customer.name}" has previously purchased these products: ${productNames}. 

Generate a brief reason (one sentence) why each product might be relevant for this customer's next invoice. Return as a JSON array with objects containing "productName" and "reason" fields.`;

      const response = await generateText(organizationId, {
        prompt,
        maxTokens: 300,
        temperature: 0.7
      });

      // Try to parse AI response as JSON
      try {
        const suggestions = JSON.parse(response.text);
        return sortedProducts.map((product, index) => ({
          productId: product.id,
          name: product.name,
          reason:
            suggestions[index]?.reason ||
            `Frequently purchased by this customer`
        }));
      } catch {
        // If JSON parsing fails, use default reasons
      }
    } catch (error) {
      console.error('Error generating AI suggestions:', error);
    }
  }

  // Fallback: return products with default reasons
  return sortedProducts.map((product) => ({
    productId: product.id,
    name: product.name,
    reason:
      productFrequency[product.id] > 0
        ? `Previously purchased ${productFrequency[product.id]} time(s)`
        : 'Available product'
  }));
}

/**
 * Generate personalized email content for payment reminders
 */
export async function generatePaymentReminderEmailContent(
  organizationId: string,
  options: {
    customerName: string;
    invoiceNo: number;
    amount: number;
    daysOverdue?: number;
    daysUntilDue?: number;
    previousReminders?: number;
  }
): Promise<{ subject: string; body: string }> {
  const systemPrompt = `You are a professional accounts receivable assistant. Generate friendly but firm payment reminder emails. The tone should be:
- Professional and courteous
- Clear about the amount due
- Appropriate urgency based on how overdue the invoice is
- Not too aggressive or demanding`;

  let prompt = `Generate a payment reminder email for:
- Customer: ${options.customerName}
- Invoice #: ${options.invoiceNo}
- Amount: $${options.amount.toFixed(2)}`;

  if (options.daysOverdue) {
    prompt += `\n- Days overdue: ${options.daysOverdue}`;
  } else if (options.daysUntilDue) {
    prompt += `\n- Days until due: ${options.daysUntilDue}`;
  }

  if (options.previousReminders && options.previousReminders > 0) {
    prompt += `\n- This is reminder #${options.previousReminders + 1}`;
  }

  prompt += `\n\nGenerate both a subject line and email body. Return as JSON: {"subject": "...", "body": "..."}`;

  const response = await generateText(organizationId, {
    prompt,
    systemPrompt,
    maxTokens: 500,
    temperature: 0.7
  });

  try {
    const parsed = JSON.parse(response.text);
    return {
      subject:
        parsed.subject || `Payment Reminder - Invoice #${options.invoiceNo}`,
      body: parsed.body || ''
    };
  } catch {
    // Fallback if JSON parsing fails
    return {
      subject: `Payment Reminder - Invoice #${options.invoiceNo}`,
      body: response.text
    };
  }
}

/**
 * Search for product price online using AI
 */
async function searchProductPriceOnline(
  organizationId: string,
  productName: string
): Promise<number | undefined> {
  const systemPrompt = `You are a product price research assistant. Your task is to find the current market price for products based on their name.

IMPORTANT:
- Return ONLY a number (the price) or the word "null" if you cannot find a reliable price
- Do not include currency symbols, text, or explanations
- Use typical retail/market prices for the product
- If the product has multiple variants, use an average or common price
- Return the price as a plain number (e.g., 99.99, not "$99.99" or "99.99 dollars")
- If you cannot determine a price, return "null"`;

  const prompt = `Find the current market/retail price for this product: "${productName}"

Search for typical retail prices from online stores, marketplaces, or manufacturer websites. Return only the numeric price value, or "null" if you cannot find a reliable price.`;

  try {
    const response = await generateText(organizationId, {
      prompt,
      systemPrompt,
      maxTokens: 100,
      temperature: 0.3
    });

    const priceText = response.text.trim().toLowerCase();

    // Try to extract number from response
    // Remove common words and extract numeric value
    const cleaned = priceText.replace(/[^0-9.]/g, '');
    const price = parseFloat(cleaned);

    if (!isNaN(price) && price > 0 && price < 1000000) {
      // Reasonable price range check (between $0.01 and $1,000,000)
      console.log(
        `Extracted online price: ${price} from response: "${response.text}"`
      );
      return price;
    }

    // If response contains "null" or "not found" or similar, return undefined
    if (
      priceText.includes('null') ||
      priceText.includes('not found') ||
      priceText.includes('unavailable') ||
      priceText.includes('cannot')
    ) {
      return undefined;
    }

    return undefined;
  } catch (error) {
    console.error('Error searching for product price online:', error);
    return undefined;
  }
}

/**
 * Search for comprehensive product details online
 */
async function searchProductDetailsOnline(
  organizationId: string,
  productName: string,
  imageUrl?: string
): Promise<{
  description?: string;
  productType?: string;
  variants?: Record<string, any>;
  price?: number;
}> {
  const systemPrompt = `You are a product research assistant. Your task is to find comprehensive product information based on the product name and optionally an image reference.

IMPORTANT: Return ONLY valid JSON. No markdown, no code blocks, no explanations. Just the JSON object.

REQUIRED JSON FORMAT:
{
  "description": "Detailed product description (2-3 sentences about features, materials, use cases, etc.)",
  "productType": "product type (e.g., 'shoe', 'tshirt', 'electronics', 'clothing', 'furniture', 'book', 'generic')",
  "variants": {
    "color": "color if applicable",
    "size": "size if applicable",
    "material": "material if applicable",
    "other relevant variant attributes"
  },
  "price": 0.00 (numeric price if found, otherwise null)
}

EXTRACTION INSTRUCTIONS:
- Search for detailed product descriptions from manufacturer websites, retailers, or product databases
- Determine the most appropriate product type based on the product name
- Extract variant information (color, size, material, etc.) if available
- Find typical retail price if available
- Return null for any field you cannot find reliable information for`;

  const prompt = imageUrl
    ? `Find comprehensive product information for: "${productName}"

Reference the product image provided to help identify the product type and extract variant details.

Search for:
1. Detailed product description (features, materials, specifications, use cases)
2. Product type (shoe, tshirt, electronics, clothing, furniture, book, or generic)
3. Variant attributes (color, size, material, model, etc.) visible in the image or from product information
4. Typical retail price

Return all information as JSON in the specified format.`
    : `Find comprehensive product information for: "${productName}"

Search for:
1. Detailed product description (features, materials, specifications, use cases)
2. Product type (shoe, tshirt, electronics, clothing, furniture, book, or generic)
3. Variant attributes (color, size, material, model, etc.)
4. Typical retail price

Return all information as JSON in the specified format.`;

  try {
    const response = await generateText(organizationId, {
      prompt,
      systemPrompt,
      imageUrl, // Include image if provided
      maxTokens: 800,
      temperature: 0.3
    });

    // Parse JSON response with robust error handling
    let jsonText = response.text.trim();
    jsonText = jsonText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonText = jsonMatch[0];
    }

    // Apply same robust JSON cleaning as in analyzeProductImage
    // Fix incomplete/malformed fields
    jsonText = jsonText.replace(/"(\w+)\s*,\s*"(\w+)"/g, '"$1": "", "$2"');

    // Find the last closing brace
    const lastBraceIndex = jsonText.lastIndexOf('}');
    if (lastBraceIndex > 0) {
      jsonText = jsonText.substring(0, lastBraceIndex + 1);
    }

    // Remove trailing commas
    jsonText = jsonText.replace(/,(\s*})/g, '$1');
    jsonText = jsonText.replace(/,(\s*\n\s*})/g, '$1');

    // Remove @node patterns
    jsonText = jsonText.replace(/@[\w]+\s*\([^)]*\)/g, '').trim();
    jsonText = jsonText.replace(/@[\w]+/g, '').trim();

    // Try to parse with error handling
    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch (parseError: any) {
      console.log(
        'Failed to parse online search JSON, trying to fix...',
        parseError.message
      );
      console.log('Problematic JSON:', jsonText);

      // Fix unterminated strings (missing closing quote)
      // Check if we have an unterminated string by looking for pattern: "field": "value without closing quote
      // Count unescaped quotes to detect unterminated strings
      const quoteMatches = jsonText.match(/"/g);
      if (quoteMatches && quoteMatches.length % 2 !== 0) {
        // Odd number of quotes means we have an unterminated string
        // Find the last field with an unterminated string value
        const unterminatedMatch = jsonText.match(/"(\w+)"\s*:\s*"([^"]*)$/m);
        if (unterminatedMatch) {
          const fieldName = unterminatedMatch[1];
          const value = unterminatedMatch[2];
          // Close the unterminated string
          jsonText = jsonText.replace(
            /"(\w+)"\s*:\s*"([^"]*)$/m,
            `"${fieldName}": "${value}"`
          );
          console.log(`Fixed unterminated string for field: ${fieldName}`);
        }
      }

      // More aggressive fixes
      jsonText = jsonText.replace(/"(\w+)\s*,\s*"(\w+)"/g, '"$1": "", "$2"');

      // Ensure JSON is properly closed
      if (!jsonText.endsWith('}')) {
        // Check if we need to close any unterminated strings first
        const openStringMatch = jsonText.match(/"(\w+)"\s*:\s*"([^"]*)$/m);
        if (openStringMatch) {
          jsonText = jsonText.replace(
            /"(\w+)"\s*:\s*"([^"]*)$/m,
            `"${openStringMatch[1]}": "${openStringMatch[2]}"`
          );
        }
        jsonText = jsonText + '}';
      }

      // Remove trailing commas
      jsonText = jsonText.replace(/,(\s*\n\s*})/g, '$1');
      jsonText = jsonText.replace(/,(\s*})/g, '$1');

      try {
        parsed = JSON.parse(jsonText);
        console.log('Successfully parsed online search JSON after fix');
      } catch (secondError: any) {
        console.error(
          'Failed to parse online search JSON after cleanup:',
          jsonText
        );
        console.error('Second error:', secondError.message);

        // Last resort: try to extract fields manually using regex
        // Extract description even if unterminated - match everything after opening quote until end of string
        // This handles cases where the string is cut off mid-sentence
        const descMatch = jsonText.match(/"description"\s*:\s*"([^"]*)/);
        const priceMatch = jsonText.match(/"price"\s*:\s*(\d+\.?\d*)/);
        const typeMatch = jsonText.match(/"productType"\s*:\s*"([^"]+)"/);
        const variantsMatch = jsonText.match(/"variants"\s*:\s*(\{[^}]*\})/);

        if (descMatch || priceMatch || typeMatch || variantsMatch) {
          // Clean up description - extract the actual text value
          let description: string | undefined = undefined;
          if (descMatch && descMatch[1]) {
            description = descMatch[1]
              .replace(/["},]+$/, '') // Remove trailing quotes, commas, braces
              .trim();
            // If description is empty after cleaning, set to undefined
            if (description === '') {
              description = undefined;
            }
          }

          parsed = {
            description: description,
            price: priceMatch ? parseFloat(priceMatch[1]) : undefined,
            productType: typeMatch ? typeMatch[1] : undefined,
            variants: variantsMatch
              ? (() => {
                  try {
                    return JSON.parse(variantsMatch[1]);
                  } catch {
                    return undefined;
                  }
                })()
              : undefined
          };
          console.log('Extracted partial data manually:', parsed);
        } else {
          // Return empty object if parsing fails
          return {};
        }
      }
    }

    return {
      description: parsed.description || undefined,
      productType: parsed.productType || undefined,
      variants: parsed.variants || undefined,
      price:
        parsed.price !== null && parsed.price !== undefined
          ? Number(parsed.price)
          : undefined
    };
  } catch (error) {
    console.error('Error searching for product details online:', error);
    return {};
  }
}

/**
 * Analyze product image and extract product details
 */
export interface ProductAnalysisResult {
  name: string;
  description?: string;
  price?: number;
  unit?: string;
  taxRate?: number;
  productType?: string;
  variants?: Record<string, any>;
}

export async function analyzeProductImage(
  organizationId: string,
  imageUrl: string
): Promise<ProductAnalysisResult> {
  const systemPrompt = `You are a product information extractor. Analyze product images and extract relevant details. 

CRITICAL: Return ONLY valid JSON. No markdown, no code blocks, no explanations, no additional text before or after. Just the JSON object.

REQUIRED JSON FORMAT - ALL FIELDS MUST BE PRESENT:
{
  "name": "Product name (required - extract from image)",
  "description": "Brief product description (extract from image if visible, otherwise empty string)",
  "price": 0.00 (REQUIRED FIELD - numeric price if visible, otherwise null),
  "unit": "piece" (unit of measurement like piece, kg, hour, etc.),
  "taxRate": 0 (tax rate percentage if visible, otherwise 0),
  "productType": "product type (e.g., 'shoe', 'tshirt', 'electronics', 'clothing', 'furniture', 'book', 'generic')",
  "variants": {
    "color": "color if visible in image",
    "size": "size if visible",
    "material": "material if visible",
    "other attributes if visible"
  }
}

MANDATORY REQUIREMENTS:
1. The "price" field MUST ALWAYS be present in the JSON response
2. If price is visible in the image, extract it as a NUMBER (remove currency symbols)
3. If NO price is visible anywhere, set "price" to null (but the field must still exist)
4. NEVER omit the "price" field from the response

EXTRACTION INSTRUCTIONS:
- Extract the product name from the image (text, labels, packaging, etc.)
- SEARCH THOROUGHLY for price: check price tags, labels, signs, receipts, displays, stickers, packaging, barcodes, or ANY visible pricing
- Extract price as a NUMBER (e.g., if you see "$19.99" or "19.99" or "€20" or "£15.50", return 19.99, 19.99, 20, or 15.50)
- Remove ALL currency symbols ($, €, £, ¥, etc.) and convert to numeric value
- Look for prices in multiple formats: "Price: $X", "$X.XX", "X.XX", "Only X", etc.
- If price is clearly visible, you MUST extract it - do not return null unless absolutely no price is visible
- Determine appropriate unit (piece, kg, hour, box, etc.) based on the product type
- Extract tax rate only if explicitly shown

OUTPUT FORMAT:
- Return ONLY the JSON object with ALL fields present
- No markdown code blocks (no \`\`\`json)
- No explanations or comments
- No trailing text or references
- Just pure, valid JSON starting with { and ending with }
- The "price" field MUST be included even if null`;

  const prompt = `Analyze this product image VERY CAREFULLY and extract ALL visible product information.

STEP-BY-STEP ANALYSIS:
1. Product Name: Look for text on labels, packaging, signs, product tags, or anywhere visible. Extract the exact product name.

2. Description: Look for product descriptions, features, or specifications visible in the image (packaging, labels, tags). Extract any visible description text.

3. Product Type: Analyze the image to determine the product type:
   - "shoe" - footwear, sneakers, boots, sandals
   - "tshirt" - t-shirts, shirts
   - "clothing" - other clothing items
   - "electronics" - phones, computers, gadgets
   - "furniture" - chairs, tables, sofas
   - "book" - books, magazines
   - "generic" - if unsure or doesn't fit categories

4. Variants: Extract variant information visible in the image:
   - Color: visible colors, color labels, color names
   - Size: size labels, size numbers (for shoes/clothing)
   - Material: material labels, fabric types
   - Model: model numbers, SKUs
   - Any other variant attributes visible

5. Price Information - THIS IS CRITICAL:
   - Scan the ENTIRE image systematically: top to bottom, left to right
   - Look for price tags, labels, stickers, signs, receipts, displays, packaging, barcodes, product labels, shelf tags, price stickers, sale tags
   - Check for prices in these formats:
     * "$X.XX" or "$X" (dollar signs)
     * "€X.XX" or "€X" (euro signs)
     * "£X.XX" or "£X" (pound signs)
     * "X.XX" or "X" (numbers alone)
     * "Price: X", "Only $X", "Sale: $X", "Now $X", "Was $X"
     * Numbers near currency symbols
     * Price tags hanging from products
     * Shelf labels below products
     * Receipts or invoices in the image
   - If you see ANY number that could be a price, extract it
   - Remove currency symbols and return ONLY the numeric value
   - If absolutely NO price is visible anywhere in the image, set to null

6. Unit: Determine how this product is sold (piece, kg, hour, box, pair, etc.)

7. Tax Rate: Only if explicitly shown (usually not visible in product images)

CRITICAL REQUIREMENTS:
- The "price" field MUST be included in your JSON response
- If you find ANY price information, extract it as a NUMBER (remove all currency symbols)
- Only set price to null if you have searched the ENTIRE image and found ZERO price information
- Extract description from visible text, labels, packaging, or product tags in the image
- Determine product type by analyzing what the product is (shoe, clothing, electronics, etc.)
- Extract variant information (color, size, material) from visible labels or the product itself
- Be thorough - information can be in unexpected places

Return the information as JSON in the specified format with ALL fields present.`;

  const response = await generateText(organizationId, {
    prompt,
    systemPrompt,
    imageUrl,
    maxTokens: 500,
    temperature: 0.3 // Lower temperature for more accurate extraction
  });

  try {
    // Try to extract JSON from response (might have markdown code blocks)
    let jsonText = response.text.trim();

    console.log('Raw AI response:', jsonText); // Debug log

    // Remove markdown code blocks if present
    jsonText = jsonText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    // Try to find JSON object in the response - match from { to the last }
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonText = jsonMatch[0];
    }

    // Clean up common issues:
    // 1. Fix incomplete/malformed fields BEFORE finding the closing brace
    // Fix cases like "description, "price" -> "description": "", "price"
    // This handles fields that are missing the colon and value (incomplete)
    jsonText = jsonText.replace(/"(\w+)\s*,\s*"(\w+)"/g, '"$1": "", "$2"');

    // Also handle cases where field name is followed by comma and another field without quotes
    jsonText = jsonText.replace(/"(\w+)\s*,\s*(\w+)"/g, '"$1": "", "$2"');

    // 2. Find the last closing brace and remove everything after it
    const lastBraceIndex = jsonText.lastIndexOf('}');
    if (lastBraceIndex > 0) {
      jsonText = jsonText.substring(0, lastBraceIndex + 1);
    }

    // 3. Remove trailing commas before closing brace (handle multiple cases)
    jsonText = jsonText.replace(/,(\s*})/g, '$1');
    jsonText = jsonText.replace(/,(\s*\n\s*})/g, '$1');

    // 4. Remove any non-JSON text patterns that might have been appended
    // Remove patterns like @node (numbers), @ref, etc.
    jsonText = jsonText.replace(/@[\w]+\s*\([^)]*\)/g, '').trim();
    jsonText = jsonText.replace(/@[\w]+/g, '').trim();

    // 5. If response is incomplete (missing closing brace), try to complete it
    if (!jsonText.endsWith('}')) {
      // Check if we have an opening brace
      if (jsonText.startsWith('{')) {
        // Remove trailing comma if present
        jsonText = jsonText.replace(/,\s*$/, '').trim();

        // Fix any incomplete last field (missing closing quote/value)
        const incompleteFieldMatch = jsonText.match(/"(\w+)"\s*:\s*"([^"]*)$/);
        if (incompleteFieldMatch) {
          // Incomplete string value - close it
          jsonText = jsonText + '""';
        }

        // Add required fields if missing
        if (!jsonText.includes('"price"')) {
          jsonText = jsonText.replace(/,\s*$/, '') + ', "price": null';
        }
        if (!jsonText.includes('"unit"')) {
          jsonText = jsonText.replace(/,\s*$/, '') + ', "unit": "piece"';
        }
        if (!jsonText.includes('"taxRate"')) {
          jsonText = jsonText.replace(/,\s*$/, '') + ', "taxRate": 0';
        }
        jsonText = jsonText + '}';
      } else {
        // If no opening brace, wrap in object
        jsonText = '{' + jsonText + '}';
      }
    }

    // 6. Final cleanup - remove any remaining trailing commas before closing brace
    jsonText = jsonText.replace(/,(\s*})/g, '$1');
    jsonText = jsonText.replace(/,(\s*\n\s*})/g, '$1');

    console.log('Cleaned JSON text:', jsonText); // Debug log

    // Try to parse, if it fails, try to fix common issues
    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch (parseError: any) {
      console.log(
        'First parse attempt failed, trying to fix JSON...',
        parseError.message
      );
      console.log('Problematic JSON:', jsonText);

      // More aggressive fixes for incomplete/malformed JSON
      // Fix incomplete string fields (missing colon and value)
      // Pattern: "fieldName, "nextField" -> "fieldName": "", "nextField"
      jsonText = jsonText.replace(/"(\w+)\s*,\s*"(\w+)"/g, '"$1": "", "$2"');

      // Also handle: "fieldName", "nextField" -> "fieldName": "", "nextField" (if missing colon)
      jsonText = jsonText.replace(
        /"(\w+)"\s*,\s*"(\w+)"/g,
        (match, field1, field2) => {
          // Check if field1 already has a colon before it
          const beforeMatch = jsonText.substring(0, jsonText.indexOf(match));
          if (!beforeMatch.trim().endsWith(':')) {
            return `"${field1}": "", "${field2}"`;
          }
          return match;
        }
      );

      // Fix incomplete string values (missing closing quote)
      jsonText = jsonText.replace(/"(\w+)"\s*:\s*"([^"]*)$/g, '"$1": "$2"');

      // Remove trailing commas more aggressively
      jsonText = jsonText.replace(/,(\s*\n\s*})/g, '$1');
      jsonText = jsonText.replace(/,(\s*})/g, '$1');

      // Ensure all required fields exist
      if (!jsonText.includes('"name"')) {
        jsonText = jsonText.replace(/\{/, '{"name": "Product", ');
      }
      if (!jsonText.includes('"price"')) {
        jsonText = jsonText.replace(/,\s*}/, ', "price": null}');
      }
      if (!jsonText.includes('"unit"')) {
        jsonText = jsonText.replace(/,\s*}/, ', "unit": "piece"}');
      }
      if (!jsonText.includes('"taxRate"')) {
        jsonText = jsonText.replace(/,\s*}/, ', "taxRate": 0}');
      }

      // Try parsing again
      try {
        parsed = JSON.parse(jsonText);
        console.log('Successfully parsed after second attempt');
      } catch (secondError: any) {
        console.error('Failed to parse JSON after cleanup:', jsonText);
        console.error('Second error:', secondError.message);

        // Last resort: try to extract at least the name and create minimal valid JSON
        const nameMatch = jsonText.match(/"name"\s*:\s*"([^"]+)"/);
        const name = nameMatch ? nameMatch[1] : 'Product';

        parsed = {
          name: name,
          description: '',
          price: null,
          unit: 'piece',
          taxRate: 0,
          productType: 'generic',
          variants: {}
        };
        console.log('Using fallback minimal JSON with name:', name);
      }
    }

    // Helper function to safely parse price
    const parsePrice = (value: any): number | undefined => {
      if (value === null || value === undefined) return undefined;
      const num =
        typeof value === 'string'
          ? parseFloat(value.replace(/[^0-9.]/g, ''))
          : Number(value);
      return !isNaN(num) && num >= 0 ? num : undefined;
    };

    // Helper function to safely parse tax rate
    const parseTaxRate = (value: any): number => {
      if (value === null || value === undefined) return 0;
      const num =
        typeof value === 'string'
          ? parseFloat(value.replace(/[^0-9.]/g, ''))
          : Number(value);
      return !isNaN(num) && num >= 0 && num <= 100 ? num : 0;
    };

    let extractedPrice = parsePrice(parsed.price);
    let description = parsed.description || '';
    let productType = parsed.productType || 'generic';
    let variants = parsed.variants || {};

    console.log('Parsed AI response from image:', {
      raw: parsed,
      price: extractedPrice,
      description: description,
      productType: productType,
      variants: variants
    });

    // If key information is missing, search online using product name and image reference
    const needsOnlineSearch =
      !description ||
      description.trim() === '' ||
      productType === 'generic' ||
      !extractedPrice ||
      Object.keys(variants).length === 0;

    if (needsOnlineSearch && parsed.name && parsed.name !== 'Product') {
      console.log('Searching online for missing product details:', {
        missingDescription: !description || description.trim() === '',
        missingProductType: productType === 'generic',
        missingPrice: !extractedPrice,
        missingVariants: Object.keys(variants).length === 0
      });

      try {
        const onlineDetails = await searchProductDetailsOnline(
          organizationId,
          parsed.name,
          imageUrl // Pass image URL as reference
        );

        // Fill in missing information from online search
        if (
          (!description || description.trim() === '') &&
          onlineDetails.description
        ) {
          description = onlineDetails.description;
          console.log('Found description online');
        }

        if (productType === 'generic' && onlineDetails.productType) {
          productType = onlineDetails.productType;
          console.log('Found product type online:', productType);
        }

        if (!extractedPrice && onlineDetails.price) {
          extractedPrice = onlineDetails.price;
          console.log('Found price online:', extractedPrice);
        }

        // Merge variants from online search
        if (
          onlineDetails.variants &&
          Object.keys(onlineDetails.variants).length > 0
        ) {
          variants = { ...variants, ...onlineDetails.variants };
          console.log('Found variants online:', variants);
        }
      } catch (error) {
        console.error('Error searching for product details online:', error);
        // Continue with what we have from image analysis
      }
    }

    return {
      name: parsed.name || 'Product',
      description: description || undefined,
      price: extractedPrice, // Will be undefined if not found in image or online
      unit: parsed.unit || 'piece',
      taxRate: parseTaxRate(parsed.taxRate),
      productType: productType,
      variants: Object.keys(variants).length > 0 ? variants : undefined
    };
  } catch (error) {
    console.error('Error parsing AI response:', error);
    // Fallback: try to extract at least the name
    return {
      name: 'Product',
      unit: 'piece',
      taxRate: 0
    };
  }
}
