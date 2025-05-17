
import { z } from 'zod';

// Define ALL supported Playwright actions
export const SupportedActionSchema = z.enum([
  'click',
  'dblclick',
  'type',
  'fill',
  'navigate',
  'press',
  'check',
  'uncheck',
  'hover',
  'selectOption',
  'focus',
  'reload',
  'goBack',
  'goForward',
  'waitForTimeout',
  'waitForSelector',
  'acceptDialog',
  'dismissDialog',
  'scrollToBottom',
  'scrollToTop',
  'scrollToElement',
  'setViewport',
  'checkVisibility',
  'checkText',
  'checkUrl',
  ], {
  errorMap: () => ({ message: 'Please select a valid action.' }),
});
export type SupportedAction = z.infer<typeof SupportedActionSchema>;

export const TestCaseStepSchemaInternal = z.object({
  action: SupportedActionSchema.describe(`The Playwright action to perform. MUST be one of: ${SupportedActionSchema.options.join(', ')}.`),
  target: z.string().describe('The target for the action. See action-specific instructions. For actions not requiring a target, provide an empty string or "N/A".'),
  description: z.string().describe('A human-readable description of the test step. See action-specific instructions.'),
  confidence: z.number().min(0).max(1).describe('A confidence score (0-1) for the reliability of this test step.')
});
export type TestCaseStep = z.infer<typeof TestCaseStepSchemaInternal>;

export const TestScenarioSchemaInternal = z.object({
  id: z.string().describe("A unique identifier for the scenario."), // Added ID for better management
  name: z.string().min(1, "Scenario name is required.").describe("A concise name for the test scenario (e.g., 'User Login', 'Product Search')."),
  description: z.string().optional().describe("A brief description of what this scenario is testing."),
  testSteps: z.array(TestCaseStepSchemaInternal).describe('An array of test steps for this scenario.')
});
export type TestScenario = z.infer<typeof TestScenarioSchemaInternal>;


// This type represents the expected output from the AI generation flow.
export interface GenerateTestScenariosOutput {
  scenarios: TestScenario[];
}


export interface TestExecutionResult {
  id: string;
  stepDescription: string;
  action: SupportedAction | string;
  target: string;
  confidence: number;
  status: 'pass' | 'fail' | 'skipped' | 'running' | 'pending';
  details?: string;
  screenshotDataUrl?: string;
  snapshotWidth?: number;
  snapshotHeight?: number;
  snapshotAiHint?: string;
}

export interface UrlInputFormData {
  url: string;
}

// Type for the form data in StepFormModal
export type StepFormModalData = {
  action: SupportedAction;
  target: string;
  description: string;
};

// Params for the Playwright execution action
export interface ExecutePlaywrightTestsParams {
  url: string;
  testSteps: TestCaseStep[];
}
