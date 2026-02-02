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
    where: { id: organizationId },
    select: {
      aiProvider: true,
      openaiApiKey: true,
      geminiApiKey: true,
      aiEnabled: true
    }
  });

  if (!organization || !organization.aiEnabled || !organization.aiProvider) {
    return null;
  }

  const apiKey =
    organization.aiProvider === 'openai'
      ? organization.openaiApiKey
      : organization.geminiApiKey;

  if (!apiKey) {
    return null;
  }

  return {
    provider: organization.aiProvider as AIProvider,
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

    const messages: Array<{ role: 'system' | 'user'; content: string }> = [];

    if (options.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }

    messages.push({ role: 'user', content: options.prompt });

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini', // Using cost-effective model, can be made configurable
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
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' }); // Using stable, cost-effective model

    let fullPrompt = options.prompt;
    if (options.systemPrompt) {
      fullPrompt = `${options.systemPrompt}\n\n${options.prompt}`;
    }

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
