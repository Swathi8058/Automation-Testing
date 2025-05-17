
'use client';

import type { TestExecutionResult, TestScenario } from '@/types/test-pilot';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, XCircle, HelpCircle, Loader2, SkipForward, Download } from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';

interface TestResultsSectionProps {
  results: TestExecutionResult[];
  scenarioTested: TestScenario;
  urlTested: string;
  onExportResults: () => void;
}

const StatusIcon = ({ status }: { status: TestExecutionResult['status'] }) => {
  if (status === 'pass') return <CheckCircle2 className="h-5 w-5 text-accent" />;
  if (status === 'fail') return <XCircle className="h-5 w-5 text-destructive" />;
  if (status === 'running') return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
  if (status === 'skipped') return <SkipForward className="h-5 w-5 text-yellow-500" />;
  return <HelpCircle className="h-5 w-5 text-muted-foreground" />; // Pending
};

export default function TestResultsSection({ results, scenarioTested, urlTested, onExportResults }: TestResultsSectionProps) {
  if (!results || !results.length) {
    return null;
  }

  const passCount = results.filter(r => r.status === 'pass').length;
  const failCount = results.filter(r => r.status === 'fail').length;
  const skippedCount = results.filter(r => r.status === 'skipped').length;
  const runningCount = results.filter(r => r.status === 'running').length;
  const pendingCount = results.filter(r => r.status === 'pending').length;
  const totalExecutedOrRunning = passCount + failCount + skippedCount + runningCount;


  let overallStatus = "Pending";
  if (totalExecutedOrRunning === results.length && totalExecutedOrRunning > 0 && pendingCount === 0) {
    overallStatus = failCount > 0 ? "Some Failed" : "All Passed/Skipped";
  } else if (runningCount > 0 || pendingCount > 0) {
    overallStatus = "In Progress";
  }


  let statusSummary = `${passCount} Passed, ${failCount} Failed, ${skippedCount} Skipped`;
  if (runningCount > 0) statusSummary += `, ${runningCount} Running`;
  if (pendingCount > 0 && (runningCount === 0 && totalExecutedOrRunning < results.length)) statusSummary += `, ${pendingCount} Pending`;


  return (
    <Card className="shadow-lg mt-8">
      <CardHeader>
        <div className="flex justify-between items-start">
            <div>
                <CardTitle className="text-xl">Execution Results for Scenario: <span className="text-primary">{scenarioTested.name}</span></CardTitle>
                <CardDescription>
                Actual Playwright results for <span className="font-semibold text-primary">{urlTested}</span>.
                Overall: {overallStatus} ({statusSummary})
                </CardDescription>
            </div>
            <Button onClick={onExportResults} variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" />
                Export Results
            </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {results.map((result, index) => (
          <Card key={result.id || index} className="overflow-hidden shadow-sm">
            <div className={cn(
              "p-4 flex items-start gap-4 border-l-4",
              result.status === 'pass' && 'border-accent bg-accent/5',
              result.status === 'fail' && 'border-destructive bg-destructive/5',
              result.status === 'running' && 'border-primary bg-primary/5',
              result.status === 'skipped' && 'border-yellow-500 bg-yellow-500/5',
              result.status === 'pending' && 'border-muted bg-muted/50'
            )}>
              <StatusIcon status={result.status} />
              <div className="flex-grow space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold">{result.stepDescription}</p>
                    <p className="text-sm text-muted-foreground">
                      Action: <Badge variant="outline">{result.action}</Badge> | Target: <Badge variant="outline" className="font-mono max-w-xs truncate inline-block align-middle">{result.target || 'N/A'}</Badge>
                    </p>
                  </div>
                  <div className="text-right min-w-[120px]">
                     <div className="flex items-center gap-2 justify-end">
                        <span>AI Conf:</span>
                        <Progress value={result.confidence * 100} className="w-16 h-1.5" title={`Confidence: ${(result.confidence * 100).toFixed(0)}%`} />
                      </div>
                  </div>
                </div>
                {result.screenshotDataUrl && result.screenshotDataUrl.startsWith('data:image') && (
                  <div className="mt-2 border rounded-md overflow-hidden shadow bg-background">
                    <Image
                      src={result.screenshotDataUrl}
                      alt={`Screenshot for step: ${result.stepDescription}`}
                      width={result.snapshotWidth || 600} 
                      height={result.snapshotHeight || 400} 
                      className="object-contain w-full max-h-[400px]"
                      unoptimized 
                    />
                  </div>
                )}
                 {result.screenshotDataUrl && result.screenshotDataUrl.startsWith('https://placehold.co') && (
                  <div className="mt-2 border rounded-md overflow-hidden shadow bg-background">
                    <Image
                      src={result.screenshotDataUrl}
                      alt={`Placeholder for step: ${result.stepDescription}`}
                      width={result.snapshotWidth || 600}
                      height={result.snapshotHeight || 400}
                      className="object-contain w-full max-h-[400px]"
                      data-ai-hint={result.snapshotAiHint || "placeholder image"}
                    />
                  </div>
                )}
                {result.status === 'fail' && result.details && (
                  <p className="text-xs text-destructive bg-destructive/10 p-2 rounded-md whitespace-pre-wrap">{result.details}</p>
                )}
                 {result.status === 'skipped' && result.details && (
                  <p className="text-xs text-yellow-700 bg-yellow-500/10 p-2 rounded-md">{result.details}</p>
                )}
                 {result.status === 'pass' && result.details && ( // For actions like acceptDialog that might have informational details
                  <p className="text-xs text-muted-foreground bg-secondary p-2 rounded-md">{result.details}</p>
                )}
              </div>
            </div>
          </Card>
        ))}
      </CardContent>
    </Card>
  );
}
