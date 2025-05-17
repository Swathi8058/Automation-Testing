
'use server';
/**
 * @fileOverview Generates test scenarios from a given URL by analyzing the DOM.
 *
 * - generateTestCases - A function that takes a URL and returns a set of test scenarios.
 * - GenerateTestCasesInput - The input type for the generateTestCases function.
 * - GenerateTestScenariosOutput - The return type for the generateTestCases function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import { SupportedActionSchema, TestScenarioSchemaInternal, TestCaseStepSchemaInternal } from '@/types/test-pilot';

const GenerateTestCasesInputSchema = z.object({
  url: z.string().url().describe('The URL of the website to generate test cases for.'),
  domContent: z.string().describe('The DOM content of the page, fetched via Playwright'),
});
export type GenerateTestCasesInput = z.infer<typeof GenerateTestCasesInputSchema>;

const GenerateTestScenariosOutputSchema = z.object({
  scenarios: z.array(TestScenarioSchemaInternal).describe('An array of test scenarios, each containing a name, description, and a set of test steps.'),
});
export type GenerateTestScenariosOutput = z.infer<typeof GenerateTestScenariosOutputSchema>;

export async function generateTestCases(input: GenerateTestCasesInput): Promise<GenerateTestScenariosOutput> {
  return generateTestCasesFlow(input);
}

const generateTestCasesPrompt = ai.definePrompt({
  name: 'generateTestCasesPrompt',
  input: {schema: GenerateTestCasesInputSchema},
  output: {schema: GenerateTestScenariosOutputSchema},
  prompt: `You are an AI test case generator. Given a URL and its DOM content, you will generate a set of test scenarios to validate the website's functionality.

URL: {{{url}}}
DOM Content: {{{domContent}}}

Identify distinct user scenarios or features from the provided DOM. For each scenario, provide a 'name', a 'description', and then an array of 'testSteps' to validate that scenario.
Aim for 3-5 distinct scenarios if possible, each with a relevant set of test steps.
Focus on covering interactive elements, user flows, edge cases, and negative tests (e.g., submitting a form with invalid data, trying to access unauthorized areas if discernible) within these scenarios.
Provide an extensive and diverse set of test steps within each scenario.

CRITICAL: When a scenario involves a 'navigate' action:
1.  Imagine the navigation has occurred and you are now analyzing the destination page.
2.  Based on the context of the navigation (e.g., link text like 'View Cart', a button like 'Go to Checkout', or navigating to a URL like '/login'), generate a comprehensive set of subsequent test steps (at least 2-4 plausible steps, more if the destination is likely complex like a form or settings page) in the *same scenario*.
3.  These subsequent steps MUST test the likely initial state or key interactive elements of that hypothesized destination page.
4.  For example, if navigating to a 'User Profile' form, don't just stop at navigation. Include steps to 'fill' a few key fields (like 'name' or 'email' if visible or inferable from labels/placeholders in the initial DOM) and a step to 'click' a 'Save' or 'Update' button. If navigating to '/products?category=electronics', include steps to 'checkVisibility' of product listings or 'click' on a filter option.
5.  These subsequent steps should still be based on your analysis of the *initial* DOM combined with common web patterns for the *hypothesized* destination page type. Act as if you have successfully navigated and are now planning tests for what you see.

Each test step within a scenario MUST include an 'action', a 'target', a 'description', and a 'confidence' score.
The 'action' field MUST be one of the following Playwright keywords: ${SupportedActionSchema.options.join(', ')}.

Action-Specific Instructions for 'target' and 'description' for each testStep:

- 'click':
    - target: CSS selector for the element to click.
    - description: e.g., "Click on the login button".
- 'dblclick':
    - target: CSS selector for the element to double-click.
    - description: e.g., "Double click the edit icon".
- 'type':
    - target: CSS selector for the input field.
    - description: MUST include the text to type. e.g., "Type 'user@example.com' into the email field". Format: "Type 'your text here' into/for [element description]".
- 'fill':
    - target: CSS selector for the input field.
    - description: MUST include the text to fill. e.g., "Fill username field with 'testUser'". Format: "Fill [element description] with 'your text here'".
- 'navigate':
    - target: The full URL to navigate to.
    - description: e.g., "Navigate to the pricing page". (Then follow CRITICAL instructions above for subsequent steps).
- 'press':
    - target: The key to press (e.g., 'Enter', 'Escape', 'Tab', 'ArrowDown'). This is a global key press on the current page.
    - description: e.g., "Press the Enter key".
- 'check':
    - target: CSS selector for a checkbox or radio button.
    - description: e.g., "Check the 'Remember me' checkbox".
- 'uncheck':
    - target: CSS selector for a checkbox.
    - description: e.g., "Uncheck the 'Subscribe to newsletter' checkbox".
- 'hover':
    - target: CSS selector for the element to hover over.
    - description: e.g., "Hover over the user menu".
- 'selectOption':
    - target: CSS selector for the <select> element.
    - description: MUST specify the option to select, ideally by its value or visible text. e.g., "Select option 'USA'" or "Select option with value 'US'". Format: "Select option 'option_value_or_text' from [element description]".
- 'focus':
    - target: CSS selector for the element to focus on.
    - description: e.g., "Focus on the search input".
- 'reload':
    - target: N/A (can be empty or ignored).
    - description: "Reload the current page".
- 'goBack':
    - target: N/A (can be empty or ignored).
    - description: "Navigate to the previous page in history".
- 'goForward':
    - target: N/A (can be empty or ignored).
    - description: "Navigate to the next page in history".
- 'waitForTimeout':
    - target: Duration in milliseconds (e.g., "1000").
    - description: e.g., "Wait for 1 second".
- 'waitForSelector':
    - target: CSS selector for the element to wait for.
    - description: e.g., "Wait for the results container to appear".
- 'acceptDialog':
    - target: N/A (can be empty or ignored).
    - description: "Accept the next dialog (alert, confirm, prompt)". This step should precede the action that triggers the dialog.
- 'dismissDialog':
    - target: N/A (can be empty or ignored).
    - description: "Dismiss the next dialog (alert, confirm, prompt)". This step should precede the action that triggers the dialog.
- 'scrollToBottom':
    - target: N/A (can be empty or ignored).
    - description: "Scroll to the bottom of the page".
- 'scrollToTop':
    - target: N/A (can be empty or ignored).
    - description: "Scroll to the top of the page".
- 'scrollToElement':
    - target: CSS selector for the element to scroll into view.
    - description: e.g., "Scroll to the footer section".
- 'setViewport':
    - target: Viewport dimensions as "widthxheight" (e.g., "1280x720").
    - description: e.g., "Set viewport to 1280x720".
- 'checkVisibility':
    - target: CSS selector for the element.
    - description: e.g., "Check visibility of the success message". This asserts the element is visible.
- 'checkText':
    - target: CSS selector for the element.
    - description: MUST include the text to check for. e.g., "Check text 'Welcome user' in greeting message". This asserts the element contains the specified text. Format: "Check text 'expected text' in/on [element description]".
- 'checkUrl':
    - target: A substring or full URL to check.
    - description: e.g., "Check URL contains '/dashboard'". This asserts the current page URL includes the target string.

The 'confidence' score for each testStep must be a number between 0 and 1.
Ensure the generated test steps are robust.
Output should be a JSON object containing an array of scenarios.
If a target is not applicable for an action (e.g., for 'reload', 'scrollToBottom'), provide an empty string or "N/A" for the target.
Provide an extensive and diverse set of test steps within each scenario, covering as many interactive elements, user flows, edge cases, and negative scenarios (e.g., invalid inputs) as possible.
`,
});

const generateTestCasesFlow = ai.defineFlow(
  {
    name: 'generateTestCasesFlow',
    inputSchema: GenerateTestCasesInputSchema,
    outputSchema: GenerateTestScenariosOutputSchema,
  },
  async input => {
    const {output} = await generateTestCasesPrompt(input);
    return output!;
  }
);

export type { GenerateTestScenariosOutput as AIGenerateTestCasesOutput };

    