
'use client';

import type { TestScenario, TestCaseStep } from '@/types/test-pilot';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Play, Loader2, Pencil, Trash2, GripVertical, PlusCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';


interface TestStepsSectionProps {
  activeScenario: TestScenario | null;
  activeScenarioIndex: number | null; // Keep this to pass to modal handlers if needed, or remove if modal directly knows
  onExecute: () => void;
  isLoadingExecution: boolean;
  onOpenAddStepModal: () => void; // No longer needs scenarioIndex if modal context is implicitly active scenario
  onOpenEditStepModal: (stepIndex: number, step: TestCaseStep) => void;
  onDeleteStep: (stepIndex: number) => void;
  onReorderStep: (startIndex: number, endIndex: number) => void;
  selectedStepIndices: Set<number>;
  onToggleStepSelection: (stepIndex: number) => void;
  onToggleSelectAllStepsInScenario: (isSelected: boolean) => void;
  onBatchDeleteSelectedSteps: () => void;
}

export default function TestStepsSection({
  activeScenario,
  // activeScenarioIndex, // Not directly used in rendering logic now, modal context is key
  onExecute,
  isLoadingExecution,
  onOpenAddStepModal,
  onOpenEditStepModal,
  onDeleteStep,
  onReorderStep,
  selectedStepIndices,
  onToggleStepSelection,
  onToggleSelectAllStepsInScenario,
  onBatchDeleteSelectedSteps,
}: TestStepsSectionProps) {
  
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
  const [dragOverItemIndex, setDragOverItemIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent<HTMLTableRowElement>, stepIndex: number) => {
    setDraggedItemIndex(stepIndex);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent<HTMLTableRowElement>, stepIndex: number) => {
    e.preventDefault();
    if (draggedItemIndex !== null) {
      setDragOverItemIndex(stepIndex);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLTableRowElement>, stepIndex: number) => {
    e.preventDefault();
    if (draggedItemIndex !== null && draggedItemIndex !== stepIndex) {
      onReorderStep(draggedItemIndex, stepIndex);
    }
    setDraggedItemIndex(null);
    setDragOverItemIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedItemIndex(null);
    setDragOverItemIndex(null);
  };

  if (!activeScenario) {
    return null; 
  }
  
  const totalSelectedSteps = selectedStepIndices.size;

  return (
    <>
      <Card className="shadow-lg mt-8">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <CardTitle className="text-xl">Test Plan for: <span className="text-primary">{activeScenario.name}</span></CardTitle>
              <CardDescription>
                {activeScenario.description || "Review, add, edit, or reorder test steps below."} 
                {" "}Click "Run Test Scenario" to execute.
              </CardDescription>
            </div>
            <div className="flex space-x-2">
                {totalSelectedSteps > 0 && (
                <Button onClick={onBatchDeleteSelectedSteps} variant="destructive" size="sm">
                    <Trash2 className="mr-2 h-4 w-4" /> Delete Selected ({totalSelectedSteps})
                </Button>
                )}
                <Button variant="outline" size="sm" onClick={onOpenAddStepModal}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Step
                </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {activeScenario.testSteps.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[3%]">
                    <Checkbox
                      checked={
                        activeScenario.testSteps.length > 0 &&
                        selectedStepIndices.size === activeScenario.testSteps.length
                      }
                      onCheckedChange={(checked) => 
                        onToggleSelectAllStepsInScenario(!!checked)
                      }
                      aria-label={`Select all steps in ${activeScenario.name}`}
                    />
                  </TableHead>
                  <TableHead className="w-[5%] text-center">#</TableHead>
                  <TableHead className="w-[27%]">Action & Target</TableHead>
                  <TableHead className="w-[35%]">Description</TableHead>
                  <TableHead className="w-[15%] text-center">Confidence</TableHead>
                  <TableHead className="w-[15%] text-right">Modify</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeScenario.testSteps.map((step, stepIndex) => (
                  <TableRow
                    key={`scenario-step-${stepIndex}`} // Ensure unique key if steps can have non-unique content
                    draggable
                    onDragStart={(e) => handleDragStart(e, stepIndex)}
                    onDragOver={(e) => handleDragOver(e, stepIndex)}
                    onDrop={(e) => handleDrop(e, stepIndex)}
                    onDragEnd={handleDragEnd}
                    className={cn(
                      "transition-all duration-150 ease-in-out cursor-grab",
                      draggedItemIndex === stepIndex && "opacity-50 bg-muted/30",
                      dragOverItemIndex === stepIndex && "bg-accent/20"
                    )}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selectedStepIndices.has(stepIndex)}
                        onCheckedChange={() => onToggleStepSelection(stepIndex)}
                        aria-label={`Select step ${stepIndex + 1}`}
                      />
                    </TableCell>
                    <TableCell className="text-center">{stepIndex + 1}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="mr-2 whitespace-nowrap">{step.action}</Badge>
                      <span className="font-mono text-sm break-all">{step.target || 'N/A'}</span>
                    </TableCell>
                    <TableCell>{step.description}</TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2">
                        <span>{(step.confidence * 100).toFixed(0)}%</span>
                        <Progress value={step.confidence * 100} className="w-16 h-1.5" />
                      </div>
                    </TableCell>
                    <TableCell className="text-right space-x-0.5">
                        <Button variant="ghost" size="icon" className="cursor-grab p-1" asChild>
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => onOpenEditStepModal(stepIndex, step)} title="Edit step" className="p-1">
                        <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => onDeleteStep(stepIndex)} title="Delete step" className="text-destructive hover:text-destructive p-1">
                        <Trash2 className="h-4 w-4" />
                        </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-sm text-center py-4">This scenario has no test steps yet. Click "Add Step" to begin.</p>
          )}
        </CardContent>
        {activeScenario.testSteps.length > 0 && (
          <CardFooter>
            <Button onClick={onExecute} className="w-full" disabled={isLoadingExecution || activeScenario.testSteps.length === 0}>
              {isLoadingExecution ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Executing Scenario...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Run Test Scenario ({activeScenario.testSteps.length} steps)
                </>
              )}
            </Button>
          </CardFooter>
        )}
      </Card>
    </>
  );
}
