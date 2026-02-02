'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { useState, useEffect } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Info, Loader2, Eye, EyeOff } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

const aiSettingsSchema = z.object({
  aiProvider: z.enum(['openai', 'gemini']).optional().nullable(),
  openaiApiKey: z.string().optional(),
  geminiApiKey: z.string().optional(),
  aiEnabled: z.boolean().default(false)
});

type AISettingsFormData = z.infer<typeof aiSettingsSchema>;

export function AISettings() {
  const queryClient = useQueryClient();
  const [showOpenAIKey, setShowOpenAIKey] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);

  // Fetch current AI settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ['ai-settings'],
    queryFn: async () => {
      const response = await fetch('/api/organizations/ai');
      if (!response.ok) {
        throw new Error('Failed to fetch AI settings');
      }
      return response.json();
    }
  });

  // Update AI settings
  const updateSettings = useMutation({
    mutationFn: async (data: AISettingsFormData) => {
      const response = await fetch('/api/organizations/ai', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update AI settings');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-settings'] });
      toast.success('AI settings updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update AI settings');
    }
  });

  const form = useForm({
    resolver: zodResolver(aiSettingsSchema),
    defaultValues: {
      aiProvider: null,
      openaiApiKey: '',
      geminiApiKey: '',
      aiEnabled: false
    }
  });

  // Update form when data loads
  useEffect(() => {
    if (settings) {
      form.reset({
        aiProvider: settings.aiProvider || null,
        openaiApiKey: settings.hasOpenAIKey ? '••••••••••••' : '',
        geminiApiKey: settings.hasGeminiKey ? '••••••••••••' : '',
        aiEnabled: settings.aiEnabled || false
      });
    }
  }, [settings, form]);

  const onSubmit = (data: AISettingsFormData) => {
    // Don't send masked keys
    const submitData: any = {
      aiProvider: data.aiProvider,
      aiEnabled: data.aiEnabled
    };

    // Only include API keys if they were changed (not masked)
    if (data.openaiApiKey && !data.openaiApiKey.startsWith('••••')) {
      submitData.openaiApiKey = data.openaiApiKey;
    }
    if (data.geminiApiKey && !data.geminiApiKey.startsWith('••••')) {
      submitData.geminiApiKey = data.geminiApiKey;
    }

    updateSettings.mutate(submitData);
  };

  if (isLoading) {
    return <div className='p-4'>Loading...</div>;
  }

  const aiProvider = form.watch('aiProvider');
  const aiEnabled = form.watch('aiEnabled');

  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Configuration</CardTitle>
        <CardDescription>
          Configure AI features to enhance your invoicing workflow. Add your API
          keys to enable AI-powered features like smart descriptions, product
          suggestions, and personalized emails.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form
          form={form}
          onSubmit={form.handleSubmit(onSubmit)}
          className='space-y-6'
        >
          {/* Enable AI Toggle */}
          <FormField
            control={form.control}
            name='aiEnabled'
            render={({ field }) => (
              <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4'>
                <div className='space-y-0.5'>
                  <FormLabel className='text-base'>
                    Enable AI Features
                  </FormLabel>
                  <FormDescription>
                    Turn on AI-powered features for your organization
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          {aiEnabled && (
            <>
              {/* AI Provider Selection */}
              <FormField
                control={form.control}
                name='aiProvider'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>AI Provider</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || ''}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder='Select an AI provider' />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value='openai'>
                          OpenAI (GPT-4o-mini)
                        </SelectItem>
                        <SelectItem value='gemini'>
                          Google Gemini (Gemini 1.5 Flash)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Choose your preferred AI provider. You'll need to provide
                      the corresponding API key below.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* OpenAI API Key */}
              {aiProvider === 'openai' && (
                <FormField
                  control={form.control}
                  name='openaiApiKey'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>OpenAI API Key</FormLabel>
                      <div className='flex gap-2'>
                        <FormControl>
                          <Input
                            type={showOpenAIKey ? 'text' : 'password'}
                            placeholder='sk-...'
                            {...field}
                            value={field.value || ''}
                            onChange={(e) => field.onChange(e.target.value)}
                          />
                        </FormControl>
                        <Button
                          type='button'
                          variant='outline'
                          size='icon'
                          onClick={() => setShowOpenAIKey(!showOpenAIKey)}
                        >
                          {showOpenAIKey ? (
                            <EyeOff className='h-4 w-4' />
                          ) : (
                            <Eye className='h-4 w-4' />
                          )}
                        </Button>
                      </div>
                      <FormDescription>
                        Get your API key from{' '}
                        <a
                          href='https://platform.openai.com/api-keys'
                          target='_blank'
                          rel='noopener noreferrer'
                          className='text-primary underline'
                        >
                          OpenAI Platform
                        </a>
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Gemini API Key */}
              {aiProvider === 'gemini' && (
                <FormField
                  control={form.control}
                  name='geminiApiKey'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Google Gemini API Key</FormLabel>
                      <div className='flex gap-2'>
                        <FormControl>
                          <Input
                            type={showGeminiKey ? 'text' : 'password'}
                            placeholder='AIza...'
                            {...field}
                            value={field.value || ''}
                            onChange={(e) => field.onChange(e.target.value)}
                          />
                        </FormControl>
                        <Button
                          type='button'
                          variant='outline'
                          size='icon'
                          onClick={() => setShowGeminiKey(!showGeminiKey)}
                        >
                          {showGeminiKey ? (
                            <EyeOff className='h-4 w-4' />
                          ) : (
                            <Eye className='h-4 w-4' />
                          )}
                        </Button>
                      </div>
                      <FormDescription>
                        Get your API key from{' '}
                        <a
                          href='https://makersuite.google.com/app/apikey'
                          target='_blank'
                          rel='noopener noreferrer'
                          className='text-primary underline'
                        >
                          Google AI Studio
                        </a>
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <Alert>
                <Info className='h-4 w-4' />
                <AlertDescription>
                  <strong>Security Note:</strong> Your API keys are stored
                  securely and only used for AI features within your
                  organization. You can change or remove them at any time. API
                  usage costs are billed directly by the AI provider.
                </AlertDescription>
              </Alert>

              <Alert variant='default'>
                <Info className='h-4 w-4' />
                <AlertDescription>
                  <strong>Available AI Features:</strong>
                  <ul className='mt-2 list-disc space-y-1 pl-5'>
                    <li>Smart invoice description generation</li>
                    <li>Product suggestions based on customer history</li>
                    <li>Personalized payment reminder emails</li>
                    <li>More features coming soon!</li>
                  </ul>
                </AlertDescription>
              </Alert>
            </>
          )}

          {/* Submit Button */}
          <div className='flex justify-end'>
            <Button type='submit' disabled={updateSettings.isPending}>
              {updateSettings.isPending && (
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
              )}
              Save Settings
            </Button>
          </div>
        </Form>
      </CardContent>
    </Card>
  );
}
