
'use client';

import * as React from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { StepFormModalData, SupportedAction } from '@/types/test-pilot';
import { SupportedActionSchema } from '@/types/test-pilot';

const actionsRequiringTarget: SupportedAction[] = [
  'click', 'dblclick', 'type', 'fill', 'navigate', 'check', 'uncheck', 
  'hover', 'selectOption', 'focus', 'waitForSelector', 'scrollToElement', 
  'setViewport', 'press', 'waitForTimeout', 'checkVisibility', 'checkText', 'checkUrl'
];

const actionsNotRequiringTarget: SupportedAction[] = [
  'reload', 'goBack', 'goForward', 'acceptDialog', 'dismissDialog', 
  'scrollToBottom', 'scrollToTop'
];

// Helper function to refine the schema based on selected action
const refineFormSchema = (data: StepFormModalData) => {
  if (actionsRequiringTarget.includes(data.action)) {
    if (!data.target || data.target.trim() === '') {
      return false; // Target is required for this action
    }
    // Specific target validation for certain actions
    if (data.action === 'waitForTimeout' && !/^\d+$/.test(data.target.trim())) {
        return false; // waitForTimeout target must be a number
    }
    if (data.action === 'setViewport' && !/^\d+x\d+$/.test(data.target.trim())) {
        return false; // setViewport target must be WxH format
    }
  }
  // Specific description validation
  if ((data.action === 'type' || data.action === 'fill' || data.action === 'checkText') && !data.description.match(/['"]([^'"]+)['"]/)) {
    return false; // Description must contain quoted text for these actions
  }
  return true;
};

const getValidationMessage = (action: SupportedAction | undefined, fieldPath: "target" | "description"): string | undefined => {
    if (!action) return undefined;

    if (fieldPath === "target") {
        if (actionsRequiringTarget.includes(action) && action === 'waitForTimeout') {
            return "Target must be a number (milliseconds).";
        }
        if (actionsRequiringTarget.includes(action) && action === 'setViewport') {
            return "Target must be in 'widthxheight' format (e.g., 1280x720).";
        }
        if (actionsRequiringTarget.includes(action)) {
            return "Target is required and cannot be empty for this action.";
        }
    }
    if (fieldPath === "description") {
        if ((action === 'type' || action === 'fill' || action === 'checkText')) {
            return `Description must include the text to ${action === 'checkText' ? 'check' : action} in quotes (e.g., Type 'example').`;
        }
    }
    return undefined;
};


const formSchema = z.object({
  action: SupportedActionSchema,
  target: z.string().optional().default(''),
  description: z.string().min(1, { message: 'Description is required.' }),
}).superRefine((data, ctx) => {
    if (actionsRequiringTarget.includes(data.action)) {
        if (!data.target || data.target.trim() === '') {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: getValidationMessage(data.action, "target") || "Target is required for this action.",
                path: ["target"],
            });
        }
        if (data.action === 'waitForTimeout' && !/^\d+$/.test(data.target.trim())) {
             ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: getValidationMessage(data.action, "target")!,
                path: ["target"],
            });
        }
        if (data.action === 'setViewport' && !/^\d+x\d+$/.test(data.target.trim())) {
             ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: getValidationMessage(data.action, "target")!,
                path: ["target"],
            });
        }
    }
    if ((data.action === 'type' || data.action === 'fill' || data.action === 'checkText') && !data.description.match(/['"]([^'"]+)['"]/)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: getValidationMessage(data.action, "description")!,
            path: ["description"],
        });
    }
});


interface StepFormModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSubmit: (data: StepFormModalData) => void;
  initialData?: StepFormModalData;
  isEditing: boolean;
}

export default function StepFormModal({ isOpen, onOpenChange, onSubmit, initialData, isEditing }: StepFormModalProps) {
  const form = useForm<StepFormModalData>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData || {
      action: undefined, 
      target: '',
      description: '',
    },
     mode: "onChange", // Validate on change for better UX with refine
  });

  React.useEffect(() => {
    if (isOpen) {
      if (initialData) {
        form.reset(initialData);
      } else {
        form.reset({ action: undefined, target: '', description: '' });
      }
    }
  }, [initialData, form, isOpen]);

  const handleFormSubmit: SubmitHandler<StepFormModalData> = (data) => {
    const currentAction = data.action;
    const finalData = {
        ...data,
        target: actionsNotRequiringTarget.includes(currentAction) ? '' : data.target ?? '',
    };
    onSubmit(finalData);
    onOpenChange(false); 
  };
  
  const currentAction = form.watch("action");
  const isTargetDisabled = currentAction ? actionsNotRequiringTarget.includes(currentAction) : false;
  const isTargetEffectivelyOptional = isTargetDisabled || !actionsRequiringTarget.includes(currentAction!);


  const getTargetPlaceholder = (action?: SupportedAction): string => {
    if (!action || isTargetDisabled) return 'N/A for this action';
    switch (action) {
      case 'navigate': return 'https://example.com';
      case 'press': return 'Enter, Tab, Escape...';
      case 'waitForTimeout': return '1000 (for 1 second)';
      case 'setViewport': return '1280x720';
      case 'checkUrl': return '/dashboard or https://example.com/path';
      case 'type':
      case 'fill':
      case 'selectOption':
      case 'checkVisibility':
      case 'checkText':
        return 'CSS selector for the element'; 
      default: return 'CSS selector, URL, key, etc.';
    }
  };

  const getDescriptionPlaceholder = (action?: SupportedAction): string => {
    if (!action) return 'Describe what this test step does';
    switch (action) {
      case 'type': return "e.g., Type 'user@example.com' into email field";
      case 'fill': return "e.g., Fill username field with 'testUser'";
      case 'selectOption': return "e.g., Select option 'USA' or Select option with value 'us'";
      case 'press': return 'e.g., Press the Enter key on the search input';
      case 'waitForTimeout': return 'e.g., Wait for 1 second for animation';
      case 'setViewport': return 'e.g., Set viewport to mobile size 375x667';
      case 'navigate': return 'e.g., Navigate to the homepage';
      case 'checkVisibility': return 'e.g., Check visibility of the success message banner';
      case 'checkText': return "e.g., Check text 'Welcome!' in greeting header";
      case 'checkUrl': return "e.g., Check URL contains '/profile'";
      default: return 'Describe what this test step does';
    }
  };


  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Test Step' : 'Add New Test Step'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4 py-4">
            <FormField
              control={form.control}
              name="action"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Action</FormLabel>
                  <Select 
                    onValueChange={(value) => {
                        field.onChange(value);
                        if (actionsNotRequiringTarget.includes(value as SupportedAction)) {
                            form.setValue('target', '', {shouldValidate: true});
                        }
                        form.trigger(['target', 'description']); // Trigger validation for dependent fields
                    }} 
                    defaultValue={field.value}
                    value={field.value} 
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select an action" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {SupportedActionSchema.options.map((supportedAction) => (
                        <SelectItem key={supportedAction} value={supportedAction}>
                          {supportedAction.charAt(0).toUpperCase() + supportedAction.slice(1).replace(/([A-Z])/g, ' $1')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="target"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{isTargetEffectivelyOptional ? 'Target (Optional)' : 'Target'}</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder={getTargetPlaceholder(currentAction)}
                      {...field} 
                      disabled={isTargetDisabled}
                      value={isTargetDisabled ? '' : field.value} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder={getDescriptionPlaceholder(currentAction)}
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
              </DialogClose>
              <Button type="submit">Save Step</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
