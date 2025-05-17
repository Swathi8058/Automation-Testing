
'use client';

import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import type { UrlInputFormData } from '@/types/test-pilot';

const formSchema = z.object({
  url: z.string().url({ message: 'Please enter a valid URL.' }),
});

interface UrlInputSectionProps {
  onSubmit: (data: UrlInputFormData) => void;
  isLoading: boolean;
  defaultValues?: Partial<UrlInputFormData>;
}

export default function UrlInputSection({ onSubmit, isLoading, defaultValues }: UrlInputSectionProps) {
  const form = useForm<UrlInputFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      url: defaultValues?.url || '',
    },
  });

  const handleFormSubmit: SubmitHandler<UrlInputFormData> = (data) => {
    onSubmit(data);
  };

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl">Start Your Test Flight</CardTitle>
        <CardDescription>Enter the URL. TestPilot will then generate test cases.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Target URL</FormLabel>
                  <FormControl>
                    <Input placeholder="https://example.com" {...field} disabled={isLoading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                'Generate Test Cases'
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

