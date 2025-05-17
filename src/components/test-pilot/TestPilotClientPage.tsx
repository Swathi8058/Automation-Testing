
'use client';

import { useState, useEffect } from 'react';
import { generateTestCasesAction, executePlaywrightTestsAction } from '@/app/actions';
import type { TestCaseStep, TestExecutionResult, UrlInputFormData, TestScenario, ExecutePlaywrightTestsParams, StepFormModalData } from '@/types/test-pilot';
import UrlInputSection from './UrlInputSection';
import TestStepsSection from './TestStepsSection';
import TestResultsSection from './TestResultsSection';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal, Loader2, Save, UploadCloud, PlusCircle, Trash2, CaseUpper, Play } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import StepFormModal from '@/components/test-pilot/StepFormModal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const LOCAL_STORAGE_KEY_TEST_PLAN_SCENARIOS = 'testPilotScenarios_v3';
const LOCAL_STORAGE_KEY_SETTINGS_V3 = 'testPilotSettings_v3';


export default function TestPilotClientPage() {
  const [isLoadingGenerate, setIsLoadingGenerate] = useState(false);
  const [isLoadingExecute, setIsLoadingExecute] = useState(false);
  const [generatedScenarios, setGeneratedScenarios] = useState<TestScenario[]>([]);
  const [activeScenarioIndex, setActiveScenarioIndex] = useState<number | null>(null);
  const [executionResults, setExecutionResults] = useState<TestExecutionResult[] | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentUrl, setCurrentUrl] = useState<string>('');

  const [isStepModalOpen, setIsStepModalOpen] = useState(false);
  const [editingStepData, setEditingStepData] = useState<StepFormModalData | undefined>(undefined);
  const [editingStepIndex, setEditingStepIndex] = useState<number | undefined>(undefined);
  
  const [selectedStepIndices, setSelectedStepIndices] = useState<Set<number>>(new Set());


  const { toast } = useToast();

  const [toastMessage, setToastMessage] = useState<{
    title: string;
    description: string;
    variant?: 'default' | 'destructive';
  } | null>(null);

 useEffect(() => {
    if (toastMessage) {
      toast({
        variant: toastMessage.variant,
        title: toastMessage.title,
        description: toastMessage.description,
      });
      setToastMessage(null);
    }
  }, [toastMessage, toast]);

  useEffect(() => {
    const savedSettings = localStorage.getItem(LOCAL_STORAGE_KEY_SETTINGS_V3);
    if (savedSettings) {
      try {
        const parsedSettings = JSON.parse(savedSettings);
        if (parsedSettings.url) setCurrentUrl(parsedSettings.url);
        // Load activeScenarioIndex if available and valid
        if (typeof parsedSettings.activeScenarioIndex === 'number') {
             const savedPlan = localStorage.getItem(LOCAL_STORAGE_KEY_TEST_PLAN_SCENARIOS);
             if (savedPlan) {
                const scenarios = JSON.parse(savedPlan) as TestScenario[];
                if (parsedSettings.activeScenarioIndex < scenarios.length) {
                    setActiveScenarioIndex(parsedSettings.activeScenarioIndex);
                }
             }
        }
      } catch (e) {
        console.error("Failed to parse saved settings:", e);
      }
    }
    handleLoadPlan(false); // Attempt to load plan silently
  }, []);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY_SETTINGS_V3, JSON.stringify({
      url: currentUrl,
      activeScenarioIndex: activeScenarioIndex,
    }));
  }, [currentUrl, activeScenarioIndex]);

  const activeScenario = activeScenarioIndex !== null && generatedScenarios[activeScenarioIndex] ? generatedScenarios[activeScenarioIndex] : null;

  const handleGenerateTests = async (data: UrlInputFormData) => {
    setIsLoadingGenerate(true);
    setErrorMessage(null);
    // setGeneratedScenarios([]); // Don't clear existing scenarios, append new ones
    setExecutionResults(null);
    setCurrentUrl(data.url);
    setSelectedStepIndices(new Set());

    const result = await generateTestCasesAction({ url: data.url });

    if (result.error) {
      setErrorMessage(result.error);
      setToastMessage({
        variant: "destructive",
        title: "Generation Failed",
        description: result.error,
      });
    } else if (result.scenarios) {
      const newScenariosWithIds = result.scenarios.map(sc => ({...sc, id: sc.id || `scenario-${Date.now()}-${Math.random()}`}));
      setGeneratedScenarios(prev => [...prev, ...newScenariosWithIds]);
      const totalSteps = result.scenarios.reduce((sum, sc) => sum + sc.testSteps.length, 0);
      setToastMessage({
        title: "Test Scenarios Generated",
        description: `Successfully generated ${result.scenarios.length} new scenarios with a total of ${totalSteps} test steps for ${data.url}.`,
      });
      if (newScenariosWithIds.length > 0 && activeScenarioIndex === null) {
        setActiveScenarioIndex(generatedScenarios.length); // Activate the first new scenario if none active
      }
    }
    setIsLoadingGenerate(false);
  };

  const handleExecuteTests = async () => {
    if (!activeScenario || activeScenario.testSteps.length === 0 || !currentUrl) {
      setToastMessage({
        variant: "destructive",
        title: "Execution Error",
        description: "No active scenario with test steps or URL available to execute.",
      });
      return;
    }

    setIsLoadingExecute(true);
    setErrorMessage(null);
    setExecutionResults(null);

    const pendingResults: TestExecutionResult[] = activeScenario.testSteps.map((step, i) => ({
      id: `step-${i}`, 
      stepDescription: step.description,
      action: step.action,
      target: step.target,
      confidence: step.confidence,
      status: 'pending',
    }));
    setExecutionResults(pendingResults);

    const params: ExecutePlaywrightTestsParams = {
      url: currentUrl,
      testSteps: activeScenario.testSteps,
    };
    const actionResult = await executePlaywrightTestsAction(params);

    setIsLoadingExecute(false);

    if (actionResult.error) {
      setErrorMessage(actionResult.error);
      setToastMessage({
        variant: "destructive",
        title: "Execution Failed",
        description: actionResult.error,
      });
      if (actionResult.results && actionResult.results.length > 0) {
        setExecutionResults(actionResult.results);
      } else {
         const failedResults: TestExecutionResult[] = activeScenario.testSteps.map((step, i) => ({
          id: `step-${i}`,
          stepDescription: step.description,
          action: step.action,
          target: step.target,
          confidence: step.confidence,
          status: 'fail',
          details: i === 0 ? actionResult.error : "Execution aborted due to an earlier error.",
        }));
        setExecutionResults(failedResults);
      }
    } else if (actionResult.results) {
      setExecutionResults(actionResult.results);
      setToastMessage({
        title: "Test Execution Finished",
        description: `Playwright execution complete for ${activeScenario.testSteps.length} steps in scenario: ${activeScenario.name}.`,
      });
    } else {
       setErrorMessage("Execution finished with no results and no specific error message.");
        setToastMessage({
            variant: "destructive",
            title: "Execution Anomaly",
            description: "The test execution finished, but no results were returned.",
        });
    }
  };

  // Scenario Management
  const handleAddNewScenario = () => {
    const newScenarioName = prompt("Enter name for the new scenario:", `New Scenario ${generatedScenarios.length + 1}`);
    if (newScenarioName) {
        const newScenario: TestScenario = {
            id: `scenario-${Date.now()}-${Math.random()}`,
            name: newScenarioName,
            description: "User-defined scenario.",
            testSteps: []
        };
        setGeneratedScenarios(prev => [...prev, newScenario]);
        setActiveScenarioIndex(generatedScenarios.length); // Activate the new scenario (index will be its position before adding)
        setSelectedStepIndices(new Set());
        setToastMessage({ title: "Scenario Added", description: `Scenario "${newScenarioName}" created.` });
    }
  };

  const handleDeleteCurrentScenario = () => {
    if (activeScenarioIndex === null) return;
    const scenarioNameToDelete = generatedScenarios[activeScenarioIndex].name;
    if (confirm(`Are you sure you want to delete the scenario "${scenarioNameToDelete}"?`)) {
        setGeneratedScenarios(prev => prev.filter((_, idx) => idx !== activeScenarioIndex));
        setToastMessage({ title: "Scenario Deleted", description: `Scenario "${scenarioNameToDelete}" has been removed.` });
        if (activeScenarioIndex >= generatedScenarios.length -1) { // -1 because length is pre-delete
             setActiveScenarioIndex(generatedScenarios.length > 1 ? generatedScenarios.length - 2 : null);
        } else {
            // Active index remains, as next scenario shifts into its place. Or set to null if it was the last.
             setActiveScenarioIndex(generatedScenarios.length > 1 ? activeScenarioIndex : null);
        }
        setSelectedStepIndices(new Set());
        setExecutionResults(null);
    }
  };
  
  const handleSelectScenario = (value: string) => {
    const index = parseInt(value, 10);
    if (!isNaN(index) && index >= 0 && index < generatedScenarios.length) {
        setActiveScenarioIndex(index);
        setSelectedStepIndices(new Set());
        setExecutionResults(null); // Clear results from previous scenario
    } else {
        setActiveScenarioIndex(null);
    }
  };


  // Step Manipulation Handlers (operate on activeScenario)
  const handleOpenAddStepModal = () => {
    if (activeScenarioIndex === null) return;
    setEditingStepData(undefined);
    setEditingStepIndex(undefined);
    setIsStepModalOpen(true);
  };

  const handleOpenEditStepModal = (stepIdx: number, step: TestCaseStep) => {
    if (activeScenarioIndex === null) return;
    setEditingStepData({ action: step.action, target: step.target, description: step.description });
    setEditingStepIndex(stepIdx);
    setIsStepModalOpen(true);
  };
  
  const handleSaveStep = (data: StepFormModalData) => {
    if (activeScenarioIndex === null) return;

    setGeneratedScenarios(prevScenarios => {
      const newScenarios = [...prevScenarios];
      const scenarioToUpdate = { ...newScenarios[activeScenarioIndex!] };
      const newSteps = [...scenarioToUpdate.testSteps];

      const newStep: TestCaseStep = {
        ...data,
        confidence: editingStepIndex !== undefined ? newSteps[editingStepIndex].confidence : 0.95,
      };

      if (editingStepIndex !== undefined) {
        newSteps[editingStepIndex] = newStep;
      } else {
        newSteps.push(newStep);
      }
      scenarioToUpdate.testSteps = newSteps;
      newScenarios[activeScenarioIndex!] = scenarioToUpdate;
      return newScenarios;
    });
    setIsStepModalOpen(false);
  };

  const handleDeleteStep = (stepIdx: number) => {
    if (activeScenarioIndex === null) return;
    setGeneratedScenarios(prevScenarios => {
      const newScenarios = [...prevScenarios];
      const scenarioToUpdate = { ...newScenarios[activeScenarioIndex!] };
      scenarioToUpdate.testSteps = scenarioToUpdate.testSteps.filter((_, i) => i !== stepIdx);
      newScenarios[activeScenarioIndex!] = scenarioToUpdate;
      return newScenarios;
    });
    setSelectedStepIndices(prev => {
        const newSelected = new Set(prev);
        newSelected.delete(stepIdx);
        return newSelected;
    });
  };

  const handleReorderStep = (startIndex: number, endIndex: number) => {
    if (activeScenarioIndex === null || startIndex === endIndex) return;
    setGeneratedScenarios(prevScenarios => {
      const newScenarios = [...prevScenarios];
      const scenarioToUpdate = { ...newScenarios[activeScenarioIndex!] };
      const steps = [...scenarioToUpdate.testSteps];
      const [removed] = steps.splice(startIndex, 1);
      steps.splice(endIndex, 0, removed);
      scenarioToUpdate.testSteps = steps;
      newScenarios[activeScenarioIndex!] = scenarioToUpdate;
      return newScenarios;
    });
  };

  // Selection Handlers (operate on activeScenario)
  const handleToggleStepSelection = (stepIdx: number) => {
    setSelectedStepIndices(prev => {
      const newSelected = new Set(prev);
      if (newSelected.has(stepIdx)) {
        newSelected.delete(stepIdx);
      } else {
        newSelected.add(stepIdx);
      }
      return newSelected;
    });
  };

  const handleToggleSelectAllStepsInScenario = (isSelected: boolean) => {
    if (!activeScenario) return;
    if (isSelected) {
      setSelectedStepIndices(new Set(activeScenario.testSteps.map((_, i) => i)));
    } else {
      setSelectedStepIndices(new Set());
    }
  };
  
  const handleBatchDeleteSelectedSteps = () => {
    if (activeScenarioIndex === null || selectedStepIndices.size === 0) return;
    setGeneratedScenarios(prevScenarios => {
      const newScenarios = [...prevScenarios];
      const scenarioToUpdate = { ...newScenarios[activeScenarioIndex!] };
      scenarioToUpdate.testSteps = scenarioToUpdate.testSteps.filter((_, stepIdx) => !selectedStepIndices.has(stepIdx));
      newScenarios[activeScenarioIndex!] = scenarioToUpdate;
      return newScenarios;
    });
    setSelectedStepIndices(new Set());
    setToastMessage({ title: "Steps Deleted", description: "Selected test steps have been removed from the current scenario."});
  };

  // Save/Load Plan
  const handleSavePlan = () => {
    if (generatedScenarios.length === 0) {
      setToastMessage({ variant: "destructive", title: "Save Failed", description: "No test scenarios to save."});
      return;
    }
    localStorage.setItem(LOCAL_STORAGE_KEY_TEST_PLAN_SCENARIOS, JSON.stringify(generatedScenarios));
    setToastMessage({ title: "Test Plan Saved", description: "Current test plan saved to browser storage."});
  };

  const handleLoadPlan = (showToast = true) => {
    const savedPlanJson = localStorage.getItem(LOCAL_STORAGE_KEY_TEST_PLAN_SCENARIOS);
    if (savedPlanJson) {
      try {
        const loadedScenarios = JSON.parse(savedPlanJson) as TestScenario[];
        if (Array.isArray(loadedScenarios)) {
          // Validate basic structure
          const isValid = loadedScenarios.every(sc => typeof sc.id === 'string' && typeof sc.name === 'string' && Array.isArray(sc.testSteps));
          if (!isValid && loadedScenarios.length > 0) { // Allow empty array
            throw new Error("Invalid test plan format in localStorage (missing id/name/testSteps).");
          }
          setGeneratedScenarios(loadedScenarios);
          setSelectedStepIndices(new Set());
          setExecutionResults(null);
          if (showToast) setToastMessage({ title: "Test Plan Loaded", description: "Test plan loaded from browser storage."});
           // Restore active scenario if possible
           const savedSettings = localStorage.getItem(LOCAL_STORAGE_KEY_SETTINGS_V3);
           if (savedSettings) {
               const parsedSettings = JSON.parse(savedSettings);
               if (typeof parsedSettings.activeScenarioIndex === 'number' && parsedSettings.activeScenarioIndex < loadedScenarios.length) {
                   setActiveScenarioIndex(parsedSettings.activeScenarioIndex);
               } else if (loadedScenarios.length > 0) {
                   setActiveScenarioIndex(0); // Default to first if saved index is invalid
               } else {
                   setActiveScenarioIndex(null);
               }
           } else if (loadedScenarios.length > 0) {
               setActiveScenarioIndex(0);
           } else {
               setActiveScenarioIndex(null);
           }
        } else {
          throw new Error("Invalid test plan format in localStorage (not an array).");
        }
      } catch (e: any) {
        console.error("Failed to load test plan:", e);
        if (showToast) setToastMessage({ variant: "destructive", title: "Load Failed", description: `Could not load test plan. ${e.message}`});
        localStorage.removeItem(LOCAL_STORAGE_KEY_TEST_PLAN_SCENARIOS); // Clear corrupted data
        setGeneratedScenarios([]);
        setActiveScenarioIndex(null);
      }
    } else {
      if (showToast) setToastMessage({ title: "No Saved Plan", description: "No saved test plan found in browser storage."});
      setGeneratedScenarios([]);
      setActiveScenarioIndex(null);
    }
  };

  const handleExportResults = () => {
    if (!executionResults || executionResults.length === 0 || !activeScenario) {
      setToastMessage({ variant: "destructive", title: "Export Failed", description: "No execution results for the current scenario to export." });
      return;
    }
    const filename = `testpilot_results_scenario_${activeScenario.name.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().split('T')[0]}.json`;
    const jsonStr = JSON.stringify({ scenarioName: activeScenario.name, url: currentUrl, results: executionResults }, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setToastMessage({ title: "Results Exported", description: `Test results for scenario "${activeScenario.name}" downloaded as ${filename}.` });
  };

  return (
    <div className="space-y-8">
      <UrlInputSection
        onSubmit={handleGenerateTests}
        isLoading={isLoadingGenerate}
        defaultValues={{ url: currentUrl }}
      />

      {errorMessage && (
        <Alert variant="destructive" className="shadow-md">
          <Terminal className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}

      <Card className="shadow-lg">
        <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex-grow">
                    <CardTitle className="text-xl">Scenario Management</CardTitle>
                </div>
                <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                    <Button onClick={handleAddNewScenario} variant="outline" size="sm" className="flex-grow sm:flex-grow-0">
                        <PlusCircle className="mr-2 h-4 w-4" /> Add New Scenario
                    </Button>
                    <Button onClick={handleSavePlan} variant="outline" size="sm" className="flex-grow sm:flex-grow-0">
                        <Save className="mr-2 h-4 w-4" /> Save Plan
                    </Button>
                    <Button onClick={() => handleLoadPlan(true)} variant="outline" size="sm" className="flex-grow sm:flex-grow-0">
                        <UploadCloud className="mr-2 h-4 w-4" /> Load Plan
                    </Button>
                </div>
            </div>
        </CardHeader>
        <CardContent className="space-y-4">
            {generatedScenarios.length > 0 ? (
                <div className="flex flex-col sm:flex-row gap-2 items-center">
                    <Select
                        onValueChange={handleSelectScenario}
                        value={activeScenarioIndex !== null ? String(activeScenarioIndex) : undefined}
                        disabled={isLoadingGenerate || isLoadingExecute}
                    >
                        <SelectTrigger className="w-full sm:w-[300px]">
                        <SelectValue placeholder="Select a scenario to view/edit" />
                        </SelectTrigger>
                        <SelectContent>
                        {generatedScenarios.map((scenario, index) => (
                            <SelectItem key={scenario.id || index} value={String(index)}>
                            {scenario.name}
                            </SelectItem>
                        ))}
                        </SelectContent>
                    </Select>
                    <Button 
                        onClick={handleDeleteCurrentScenario} 
                        variant="destructive" 
                        size="sm" 
                        disabled={activeScenarioIndex === null || isLoadingGenerate || isLoadingExecute}
                        className="w-full sm:w-auto"
                    >
                        <Trash2 className="mr-2 h-4 w-4" /> Delete Current Scenario
                    </Button>
                </div>
            ) : (
                <p className="text-muted-foreground text-center py-2">No scenarios created yet. Generate some or add a new one!</p>
            )}
        </CardContent>
      </Card>


      {activeScenario && (
        <TestStepsSection
          activeScenario={activeScenario}
          activeScenarioIndex={activeScenarioIndex!}
          onExecute={handleExecuteTests}
          isLoadingExecution={isLoadingExecute}
          onOpenAddStepModal={handleOpenAddStepModal}
          onOpenEditStepModal={handleOpenEditStepModal}
          onDeleteStep={handleDeleteStep}
          onReorderStep={handleReorderStep}
          selectedStepIndices={selectedStepIndices}
          onToggleStepSelection={handleToggleStepSelection}
          onToggleSelectAllStepsInScenario={handleToggleSelectAllStepsInScenario}
          onBatchDeleteSelectedSteps={handleBatchDeleteSelectedSteps}
        />
      )}
       {!activeScenario && generatedScenarios.length > 0 && !isLoadingGenerate && (
          <Alert className="shadow-md">
            <CaseUpper className="h-4 w-4 mr-2" />
            <AlertTitle>No Scenario Selected</AlertTitle>
            <AlertDescription>Please select a scenario from the dropdown above to view or manage its test steps.</AlertDescription>
        </Alert>
      )}


      {isLoadingGenerate && generatedScenarios.length === 0 && !errorMessage && (
         <Alert className="shadow-md">
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            <AlertTitle>Generating Test Scenarios</AlertTitle>
            <AlertDescription>The AI is analyzing the URL and generating test scenarios. This may take a moment...</AlertDescription>
        </Alert>
      )}


      {executionResults && currentUrl && activeScenario && (
        <TestResultsSection
            results={executionResults}
            scenarioTested={activeScenario}
            urlTested={currentUrl}
            onExportResults={handleExportResults}
        />
      )}

      {activeScenarioIndex !== null && (
          <StepFormModal
            isOpen={isStepModalOpen}
            onOpenChange={setIsStepModalOpen}
            onSubmit={handleSaveStep}
            initialData={editingStepData}
            isEditing={editingStepIndex !== undefined}
          />
      )}
    </div>
  );
}
