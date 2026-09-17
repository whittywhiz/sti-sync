import { parentPort, workerData } from "worker_threads";
import { runGA, buildRequirements } from "./ga";
import { SchedulingInput } from "./types";

interface WorkerInput {
  schedulingInput: SchedulingInput;
  populationSize?: number;
  maxGenerations?: number;
}

function main() {
  const { schedulingInput, populationSize, maxGenerations } =
    workerData as WorkerInput;

  const requirements = buildRequirements(schedulingInput);

  const result = runGA(requirements, schedulingInput, {
    populationSize,
    maxGenerations,
  });

  if (!result.feasible) {
    parentPort?.postMessage({
      success: false,
      error: `GA could not find a conflict-free schedule after ${result.generationsRun} generations (${result.hardViolationCount} hard constraint violation(s) remain in the best candidate found). Try again, or check for infeasible data.`,
    });
    return;
  }

  parentPort?.postMessage({ success: true, result });
}

try {
  main();
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  parentPort?.postMessage({ success: false, error: message });
}
