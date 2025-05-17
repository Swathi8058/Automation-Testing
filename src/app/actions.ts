
'use server';

import { generateTestCases, type GenerateTestCasesInput, type GenerateTestScenariosOutput } from '@/ai/flows/generate-test-cases';
import type { TestCaseStep, TestExecutionResult, SupportedAction, ExecutePlaywrightTestsParams, TestScenario } from '@/types/test-pilot';
import { chromium, type Browser as PlaywrightBrowser, type Page } from 'playwright';

interface GenerateTestCasesActionResult {
  scenarios?: TestScenario[];
  error?: string;
}

export async function generateTestCasesAction(
  data: { url: string }
): Promise<GenerateTestCasesActionResult> {
  let browser: PlaywrightBrowser | undefined;
  try {
    if (!data.url) {
      return { error: 'URL is required.' };
    }

    try {
      new URL(data.url);
    } catch (_) {
      return { error: 'Invalid URL format.' };
    }

    console.log("Launching Playwright for DOM fetching (headed in dev)...");
    const isDevelopment = process.env.NODE_ENV === 'development';
    browser = await chromium.launch({ headless: !isDevelopment });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    });
    const page = await context.newPage();

    let domContent: string | null = null;
    try {
      console.log(`Navigating to ${data.url} for DOM fetch...`);
      await page.goto(data.url, { waitUntil: 'networkidle', timeout: 45000 });
      console.log("Navigation complete, waiting for 3s for dynamic content...");
      await page.waitForTimeout(3000);
      domContent = await page.content();
      console.log("DOM content fetched.");
    } catch (navError) {
      console.error('Playwright navigation error during DOM fetch:', navError);
      return { error: `Failed to navigate to URL for DOM fetching: ${data.url}. The site might be down or blocking automated access. ${(navError as Error).message}` };
    } finally {
        if (browser && isDevelopment) {
            console.log("DOM fetching: Playwright browser closing after 5s delay (dev mode)...");
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
        if (browser) {
            await browser.close();
            console.log("Playwright browser for DOM fetch closed.");
        }
    }

    if (!domContent) {
      return { error: 'Failed to fetch DOM content from the URL.' };
    }

    const input: GenerateTestCasesInput = {
      url: data.url,
      domContent: domContent,
    };

    console.log("Calling AI to generate test scenarios...");
    const result: GenerateTestScenariosOutput = await generateTestCases(input);
    console.log("AI response received.");

    if (result && result.scenarios) {
      const validatedScenarios = result.scenarios.map(scenario => ({
        ...scenario,
        testSteps: scenario.testSteps.map(step => ({
          ...step,
          action: step.action as SupportedAction, // Ensure action type
        })) as TestCaseStep[],
      })) as TestScenario[];
      return { scenarios: validatedScenarios };
    } else {
      const aiErrorReason = result && 'error' in (result as any) ? (result as any).error : 'The AI returned an unexpected response.';
      return { error: `Failed to generate test scenarios. ${aiErrorReason}` };
    }
  } catch (error) {
    console.error('Error generating test scenarios:', error);
    if (error instanceof Error) {
      if (error.message.includes('Target closed')) {
        return { error: `Playwright error: The page or browser context was closed unexpectedly. Please try again.` };
      }
       if (error.message.includes('fetch failed') && error.message.includes('generativelanguage.googleapis.com')) {
         if (error.message.includes('503') || error.message.toLowerCase().includes('model is overloaded')) {
            return { error: 'The AI model is temporarily overloaded (503 Service Unavailable). Please wait a few moments and try again.' };
         }
        return { error: 'Failed to communicate with the AI service. Please check your internet connection and ensure your GOOGLE_API_KEY is correctly configured in the .env file and has the Generative Language API enabled.' };
      }
      if (error.message.includes('Executable doesn\'t exist') || error.message.includes('Host system is missing dependencies')) {
        return { error: `Playwright setup error: ${error.message}. Please run 'npx playwright install' and 'npx playwright install-deps' in your project terminal, then restart the server.`};
      }
      return { error: `An error occurred: ${error.message}` };
    }
    return { error: 'An unknown error occurred while generating test scenarios.' };
  }
}

interface ExecutePlaywrightTestsActionResult {
  results?: TestExecutionResult[];
  error?: string;
}

export async function executePlaywrightTestsAction(
  params: ExecutePlaywrightTestsParams
): Promise<ExecutePlaywrightTestsActionResult> {
  const { url, testSteps } = params;
  if (!url || !testSteps || testSteps.length === 0) {
    return { error: 'URL and test steps are required to execute tests.' };
  }

  let browser: PlaywrightBrowser | undefined;
  const executedResults: TestExecutionResult[] = [];
  const isDevelopment = process.env.NODE_ENV === 'development';

  try {
    console.log("Launching Playwright for test execution (headed in dev)...");
    browser = await chromium.launch({ headless: !isDevelopment });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    });
    const page = await context.newPage();

    console.log(`Navigating to URL: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

    for (let i = 0; i < testSteps.length; i++) {
      const step = testSteps[i];
      let status: TestExecutionResult['status'] = 'fail';
      let details: string | undefined;
      let screenshotDataUrl: string | undefined;
      const snapshotWidth = 600;
      let snapshotHeight = 400;
      let snapshotAiHint = "ui element";

      console.log(`Executing step ${i + 1}: ${step.description} (Action: ${step.action}, Target: ${step.target})`);

      try {
        switch (step.action.toLowerCase() as SupportedAction | string) {
          case 'click':
            await page.locator(step.target).click({ timeout: 10000 });
            status = 'pass';
            break;
          case 'dblclick':
            await page.locator(step.target).dblclick({ timeout: 10000 });
            status = 'pass';
            break;
          case 'type': {
            let textToType = "TestPilot input";
            const typeMatch = step.description.match(/type\s*['"]([^'"]+)['"]/i) || step.description.match(/with\s*['"]([^'"]+)['"]/i);
            if (typeMatch && typeMatch[1]) {
              textToType = typeMatch[1];
            } else if (step.description.toLowerCase().includes("type") && step.description.includes("'")) {
              const parts = step.description.split("'");
              if (parts.length >= 2) textToType = parts[1];
            }
            console.log(`Typing "${textToType}" into ${step.target}`);
            await page.locator(step.target).type(textToType, { delay: 50, timeout: 10000 });
            status = 'pass';
            break;
          }
          case 'fill': {
            let textToFill = "TestPilot input";
            const fillMatch = step.description.match(/(?:fill|with)\s*['"]([^'"]+)['"]/i);
            if (fillMatch && fillMatch[1]) {
              textToFill = fillMatch[1];
            } else if (step.description.toLowerCase().includes("fill") && step.description.includes("'")) {
               const parts = step.description.split("'");
               if (parts.length >=2) textToFill = parts[1];
            }
            console.log(`Filling "${textToFill}" into ${step.target}`);
            await page.locator(step.target).fill(textToFill, { timeout: 10000 });
            status = 'pass';
            break;
          }
          case 'navigate':
            console.log(`Navigating to ${step.target}`);
            await page.goto(step.target, { waitUntil: 'networkidle', timeout: 15000 });
            status = 'pass';
            break;
          case 'press':
            console.log(`Pressing key "${step.target}"`);
            await page.keyboard.press(step.target);
            status = 'pass';
            break;
          case 'check':
            console.log(`Checking element "${step.target}"`);
            await page.locator(step.target).check({ timeout: 10000 });
            status = 'pass';
            break;
          case 'uncheck':
            console.log(`Unchecking element "${step.target}"`);
            await page.locator(step.target).uncheck({ timeout: 10000 });
            status = 'pass';
            break;
          case 'hover':
            console.log(`Hovering over element "${step.target}"`);
            await page.locator(step.target).hover({ timeout: 5000 });
            status = 'pass';
            break;
          case 'selectoption':
            {
              const selectMatch = step.description.match(/select\s*(?:option)?\s*['"]([^'"]+)['"]/i);
              let optionToSelect: string | { label: string } | { value: string } | { index: number } = '';
              if (selectMatch && selectMatch[1]) {
                optionToSelect = selectMatch[1];
              } else if (step.target) {
                console.warn(`'selectOption' description didn't yield value, trying target as value: ${step.target}`);
                optionToSelect = step.target;
              }

              if (optionToSelect) {
                console.log(`Selecting option "${typeof optionToSelect === 'string' ? optionToSelect : JSON.stringify(optionToSelect)}" in ${step.target}`);
                 try {
                  await page.locator(step.target).selectOption(optionToSelect, { timeout: 10000 });
                } catch (e1) {
                  console.warn(`Failed to select by value/label '${optionToSelect}', trying as label explicitly.`);
                  try {
                    await page.locator(step.target).selectOption({ label: optionToSelect as string }, { timeout: 10000 });
                  } catch (e2) {
                    console.warn(`Failed to select by explicit label '${optionToSelect}'.`);
                    throw e2;
                  }
                }
              } else {
                details = "Could not determine option to select from description for 'selectOption'.";
                status = 'fail';
                break;
              }
              status = 'pass';
              break;
            }
          case 'focus':
            await page.locator(step.target).focus({ timeout: 5000 });
            status = 'pass';
            break;
          case 'reload':
            await page.reload({ waitUntil: 'networkidle', timeout: 15000 });
            status = 'pass';
            break;
          case 'goback':
            await page.goBack({ waitUntil: 'networkidle', timeout: 15000 });
            status = 'pass';
            break;
          case 'goforward':
            await page.goForward({ waitUntil: 'networkidle', timeout: 15000 });
            status = 'pass';
            break;
          case 'waitfortimeout':
            const timeoutMs = parseInt(step.target, 10);
            if (isNaN(timeoutMs)) {
              details = `Invalid timeout value: ${step.target}`;
              status = 'fail';
            } else {
              await page.waitForTimeout(timeoutMs);
              status = 'pass';
            }
            break;
          case 'waitforselector':
            await page.waitForSelector(step.target, { state: 'visible', timeout: 10000 });
            status = 'pass';
            break;
          case 'acceptdialog':
            page.once('dialog', async dialog => {
              console.log(`Dialog message: ${dialog.message()}, type: ${dialog.type()}. Accepting.`);
              await dialog.accept();
            });
            status = 'pass';
            details = "Listener for accepting next dialog is active.";
            break;
          case 'dismissdialog':
            page.once('dialog', async dialog => {
              console.log(`Dialog message: ${dialog.message()}, type: ${dialog.type()}. Dismissing.`);
              await dialog.dismiss();
            });
            status = 'pass';
            details = "Listener for dismissing next dialog is active.";
            break;
          case 'scrolltobottom':
            await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
            status = 'pass';
            break;
          case 'scrolltotop':
            await page.evaluate(() => window.scrollTo(0, 0));
            status = 'pass';
            break;
          case 'scrolltoelement':
            await page.locator(step.target).scrollIntoViewIfNeeded({ timeout: 5000 });
            status = 'pass';
            break;
          case 'setviewport':
            const parts = step.target.split('x');
            if (parts.length === 2) {
              const width = parseInt(parts[0], 10);
              const height = parseInt(parts[1], 10);
              if (!isNaN(width) && !isNaN(height)) {
                await page.setViewportSize({ width, height });
                status = 'pass';
              } else {
                details = `Invalid viewport format: ${step.target}. Expected "widthxheight".`;
                status = 'fail';
              }
            } else {
              details = `Invalid viewport format: ${step.target}. Expected "widthxheight".`;
              status = 'fail';
            }
            break;
          case 'checkvisibility':
            const isVisible = await page.locator(step.target).isVisible({ timeout: 5000 });
            if (isVisible) {
              status = 'pass';
            } else {
              status = 'fail';
              details = `Element '${step.target}' was not visible.`;
            }
            break;
          case 'checktext': {
            const textContent = await page.locator(step.target).textContent({ timeout: 5000 });
            const textMatch = step.description.match(/check text\s*['"]([^'"]+)['"]/i);
            if (textMatch && textMatch[1]) {
              const expectedText = textMatch[1];
              if (textContent?.includes(expectedText)) {
                status = 'pass';
              } else {
                status = 'fail';
                details = `Element '${step.target}' did not contain text '${expectedText}'. Actual text: "${textContent}"`;
              }
            } else {
              status = 'fail';
              details = `Could not extract expected text from description for 'checkText': ${step.description}`;
            }
            break;
          }
          case 'checkurl':
            const currentUrl = page.url();
            if (currentUrl.includes(step.target)) {
              status = 'pass';
            } else {
              status = 'fail';
              details = `Current URL '${currentUrl}' did not contain target '${step.target}'.`;
            }
            break;
          default:
            status = 'skipped';
            details = `Action type "${step.action}" is not currently supported by the Playwright executor.`;
            console.log(details);
        }
      } catch (e) {
        status = 'fail';
        details = e instanceof Error ? e.message : String(e);
        console.error(`Step ${i + 1} failed: ${details}`);
      }

      try {
        const screenshotBuffer = await page.screenshot();
        screenshotDataUrl = `data:image/png;base64,${screenshotBuffer.toString('base64')}`;
        snapshotHeight = 0;
        snapshotAiHint = "";
      } catch (screenshotError) {
        console.error('Failed to take screenshot for step:', screenshotError);
        snapshotHeight = Math.floor(300 + Math.random() * 200);
        snapshotAiHint = "error screenshot";
        screenshotDataUrl = `https://placehold.co/${snapshotWidth}x${snapshotHeight}.png`;
      }

      executedResults.push({
        id: `step-${i}`,
        stepDescription: step.description,
        action: step.action,
        target: step.target,
        confidence: step.confidence,
        status,
        details,
        screenshotDataUrl,
        snapshotWidth: snapshotHeight === 0 ? 0 : snapshotWidth,
        snapshotHeight,
        snapshotAiHint,
      });

      if (status === 'fail' && (step.action.toLowerCase() === 'acceptdialog' || step.action.toLowerCase() === 'dismissdialog')) {
        // If setting up a dialog handler fails, it's a critical setup issue
      } else if (status === 'fail') {
         // Optional: Stop further execution if a non-dialog step fails
         // console.log("Stopping execution due to step failure.");
         // break;
      }
    }

    if (isDevelopment) {
      console.log("Playwright test execution finished. Keeping browser open for 5 seconds for observation (dev mode only)...");
      await page.waitForTimeout(5000);
    }
    console.log("All test steps processed.");
    return { results: executedResults };

  } catch (error) {
    console.error('Critical error during Playwright test execution:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred during Playwright test execution.';
    if (executedResults.length < testSteps.length && testSteps.length > 0) {
        const remainingSteps = testSteps.slice(executedResults.length);
        remainingSteps.forEach((step, idx) => {
            executedResults.push({
                id: `step-${executedResults.length}`,
                stepDescription: step.description,
                action: step.action,
                target: step.target,
                confidence: step.confidence,
                status: 'fail',
                details: executedResults.length === 0 && idx === 0 ? errorMessage : 'Execution aborted due to a critical error.',
                screenshotDataUrl: `https://placehold.co/600x400.png`,
                snapshotWidth: 600,
                snapshotHeight: 400,
                snapshotAiHint: "error"
            });
        });
    } else if (executedResults.length === 0 && testSteps.length > 0) {
         executedResults.push({
            id: 'execution-setup-error',
            stepDescription: 'Failed to initialize or run the Playwright test execution environment.',
            action: 'system' as SupportedAction,
            target: 'N/A',
            confidence: 0,
            status: 'fail',
            details: errorMessage,
            screenshotDataUrl: `https://placehold.co/600x400.png`,
            snapshotWidth: 600,
            snapshotHeight: 400,
            snapshotAiHint: "error"
        });
    }
    return { results: executedResults, error: errorMessage };
  } finally {
    if (browser) {
      console.log("Closing Playwright browser for test execution.");
      await browser.close();
    }
  }
}
