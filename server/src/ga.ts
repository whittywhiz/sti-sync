import {
  SchedulingInput,
  CurriculumEntry,
  ClassAssignment,
  Candidate,
  EmployeeData,
  DayData,
  AvailabilityData,
  PROGRAM_HOME_LAB_ROOM_NUMBERS,
} from "./types";
import { scoreCandidate, hasHardViolations } from "./csp";

export interface SchedulingRequirement {
  section_id: number;
  course_code: string;
  session_number: 1 | 2;
  session_duration_hours: number;
  prefers_lab_room?: boolean;
  preferred_room_numbers?: string[] | undefined;
}

export function buildRequirements(
  input: SchedulingInput,
): SchedulingRequirement[] {
  const requirements: SchedulingRequirement[] = [];
  const courseMap = new Map(input.courses.map((c) => [c.course_code, c]));

  const SPLIT_EXCLUDED_COURSE_CODES = new Set<string>(["PATHFIT"]);

  for (const section of input.sections) {
    const matchingCourses = input.curriculum.filter(
      (c: CurriculumEntry) =>
        c.program_id === section.program_id &&
        c.year_level === section.year_level,
    );
    for (const curriculumEntry of matchingCourses) {
      const course = courseMap.get(curriculumEntry.course_code);
      const totalHours = Number(course?.total_hours ?? 1.5);

      const courseTypeLabel =
        (course as any)?.course_type_description ??
        (course as any)?.course_type?.course_type_description ??
        "";
      const isLab = String(courseTypeLabel).toLowerCase().includes("lab");
      const homeRoomNumbers = isLab
        ? PROGRAM_HOME_LAB_ROOM_NUMBERS[section.program_id]
        : undefined;

      const isExcludedFromSplitting =
        SPLIT_EXCLUDED_COURSE_CODES.has(curriculumEntry.course_code) ||
        totalHours <= 2;

      if (isExcludedFromSplitting) {
        requirements.push({
          section_id: section.section_id,
          course_code: curriculumEntry.course_code,
          session_number: 1,
          session_duration_hours: Number(totalHours),
          preferred_room_numbers: homeRoomNumbers,
        });
        continue;
      }

      // New splitting formula: 3→2/1, 4→3/1, 5→3/2, 6→4/2
      let session1Hours: number;
      let session2Hours: number;

      switch (Math.round(totalHours)) {
        case 3:
          session1Hours = 2;
          session2Hours = 1;
          break;
        case 4:
          session1Hours = 3;
          session2Hours = 1;
          break;
        case 5:
          session1Hours = 3;
          session2Hours = 2;
          break;
        case 6:
          session1Hours = 4;
          session2Hours = 2;
          break;
        default:
          // Fallback for other durations
          session2Hours = totalHours <= 4 ? 1 : 2;
          session1Hours = totalHours - session2Hours;
      }

      requirements.push({
        section_id: section.section_id,
        course_code: curriculumEntry.course_code,
        session_number: 1,
        session_duration_hours: session1Hours,
        prefers_lab_room: isLab,
        preferred_room_numbers: homeRoomNumbers,
      });

      requirements.push({
        section_id: section.section_id,
        course_code: curriculumEntry.course_code,
        session_number: 2,
        session_duration_hours: session2Hours,
        prefers_lab_room: false, // Session 2 does NOT prefer lab (soft constraint instead)
        preferred_room_numbers: undefined,
      });
    }
  }
  return requirements;
}

function randomFrom<T>(arr: T[]): T {
  const index = Math.floor(Math.random() * arr.length);
  return arr[index]!;
}

function buildEmployeesByDay(
  input: SchedulingInput,
): Map<number, EmployeeData[]> {
  const employeeMap = new Map(input.employees.map((e) => [e.employee_id, e]));
  const result = new Map<number, EmployeeData[]>();

  for (const day of input.days) {
    const employeeIdsForDay = new Set(
      input.availability
        .filter((a) => a.day_id === day.day_id)
        .map((a) => a.employee_id),
    );
    const employeesForDay = Array.from(employeeIdsForDay)
      .map((id) => employeeMap.get(id))
      .filter((e): e is EmployeeData => e !== undefined);
    result.set(day.day_id, employeesForDay);
  }

  return result;
}

function pickDayWithAvailableEmployees(
  input: SchedulingInput,
  employeesByDay: Map<number, EmployeeData[]>,
): DayData {
  const daysWithAvailability = input.days.filter(
    (d) => (employeesByDay.get(d.day_id)?.length ?? 0) > 0,
  );
  if (daysWithAvailability.length > 0) {
    return randomFrom(daysWithAvailability);
  }
  return randomFrom(input.days);
}

function pickEmployeeForDay(
  input: SchedulingInput,
  dayId: number,
  employeesByDay: Map<number, EmployeeData[]>,
): EmployeeData {
  const availableEmployees = employeesByDay.get(dayId) ?? [];
  if (availableEmployees.length > 0) {
    return randomFrom(availableEmployees);
  }
  return randomFrom(input.employees);
}

function buildAvailabilityByEmployeeDay(
  input: SchedulingInput,
): Map<string, AvailabilityData[]> {
  const map = new Map<string, AvailabilityData[]>();
  for (const a of input.availability) {
    const key = `${a.employee_id}-${a.day_id}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(a);
  }
  return map;
}

const WORKING_DAY_START_MIN = 7 * 60;
const WORKING_DAY_END_MIN = 20 * 60;
const SLOT_GRANULARITY_MIN = 30;

const EMPLOYEE_ATTEMPT_LIMIT = 4;
const DAY_ATTEMPT_LIMIT = 3;

function minutesToTime(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

function timeToMinutes(time: string): number {
  const parts = time.split(":").map(Number);
  return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
}

function timeRangesOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}

function pickRandomTimeSlot(durationHours: number): {
  start_time: string;
  end_time: string;
} {
  const durationMin = Math.round(durationHours * 60);
  const latestPossibleStart = WORKING_DAY_END_MIN - durationMin;

  if (latestPossibleStart < WORKING_DAY_START_MIN) {
    return {
      start_time: minutesToTime(WORKING_DAY_START_MIN),
      end_time: minutesToTime(WORKING_DAY_START_MIN + durationMin),
    };
  }

  const slotCount =
    Math.floor(
      (latestPossibleStart - WORKING_DAY_START_MIN) / SLOT_GRANULARITY_MIN,
    ) + 1;
  const randomSlotIndex = Math.floor(Math.random() * slotCount);
  const startMin =
    WORKING_DAY_START_MIN + randomSlotIndex * SLOT_GRANULARITY_MIN;

  return {
    start_time: minutesToTime(startMin),
    end_time: minutesToTime(startMin + durationMin),
  };
}

function pickTimeSlotForEmployeeDay(
  employeeId: number,

  dayId: number,
  durationHours: number,
  availabilityByEmployeeDay: Map<string, AvailabilityData[]>,
): { start_time: string; end_time: string } {
  const durationMin = Math.round(durationHours * 60);
  const windows = availabilityByEmployeeDay.get(`${employeeId}-${dayId}`) ?? [];

  const validStarts: number[] = [];
  for (const w of windows) {
    const windowStart = timeToMinutes(w.start_time);
    const windowEnd = timeToMinutes(w.end_time);
    const latestStart = windowEnd - durationMin;
    for (
      let start = windowStart;
      start <= latestStart;
      start += SLOT_GRANULARITY_MIN
    ) {
      validStarts.push(start);
    }
  }

  if (validStarts.length > 0) {
    const chosenStart = randomFrom(validStarts);
    return {
      start_time: minutesToTime(chosenStart),
      end_time: minutesToTime(chosenStart + durationMin),
    };
  }

  return pickRandomTimeSlot(durationHours);
}

function getConflictFreeStarts(
  employee: EmployeeData,
  windows: AvailabilityData[],
  bookedIntervals: { start: number; end: number }[],
  durationMin: number,
  currentDayHours: number,
  currentWeekHours: number,
): number[] {
  const durationHours = durationMin / 60;

  if (
    employee.max_hours_per_day != null &&
    currentDayHours + durationHours > employee.max_hours_per_day
  ) {
    return [];
  }
  if (
    employee.max_hours_per_week != null &&
    currentWeekHours + durationHours > employee.max_hours_per_week
  ) {
    return [];
  }

  const validStarts: number[] = [];
  for (const w of windows) {
    const windowStart = timeToMinutes(w.start_time);
    const windowEnd = timeToMinutes(w.end_time);
    const latestStart = windowEnd - durationMin;
    for (
      let start = windowStart;
      start <= latestStart;
      start += SLOT_GRANULARITY_MIN
    ) {
      const end = start + durationMin;
      const conflicts = bookedIntervals.some((b) =>
        timeRangesOverlap(start, end, b.start, b.end),
      );
      if (!conflicts) validStarts.push(start);
    }
  }
  return validStarts;
}

function pickRoomForRequirement(
  req: SchedulingRequirement,
  courseType: string,
  input: SchedulingInput,
): { room_id: number } {
  const labRooms = input.rooms.filter(
    (r) => r.type?.toLowerCase() === "laboratory",
  );
  const matchingTypeRooms = input.rooms.filter(
    (r) => r.type?.toLowerCase() === courseType,
  );
  const room =
    req.prefers_lab_room && labRooms.length > 0
      ? randomFrom(labRooms)
      : matchingTypeRooms.length > 0
        ? randomFrom(matchingTypeRooms)
        : randomFrom(input.rooms);
  return room;
}

export function generateRandomCandidate(
  requirements: SchedulingRequirement[],
  input: SchedulingInput,
): ClassAssignment[] {
  const courseMap = new Map(input.courses.map((c) => [c.course_code, c]));
  const employeesByDay = buildEmployeesByDay(input);
  const availabilityByEmployeeDay = buildAvailabilityByEmployeeDay(input);

  const bookedIntervalsByEmployeeDay = new Map<
    string,
    { start: number; end: number }[]
  >();
  const hoursByEmployeeDay = new Map<string, number>();
  const hoursByEmployeeWeek = new Map<number, number>();

  const assignments: ClassAssignment[] = [];

  for (const req of requirements) {
    const course = courseMap.get(req.course_code);
    const courseType = (course?.course_type_description ?? "").toLowerCase();
    const room = pickRoomForRequirement(req, courseType, input);

    const durationHours =
      req.session_duration_hours ?? course?.total_hours ?? 1.5;
    const durationMin = Math.round(durationHours * 60);

    let chosenDay: DayData | null = null;
    let chosenEmployee: EmployeeData | null = null;
    let chosenStart: number | null = null;

    dayAttempts: for (
      let dAttempt = 0;
      dAttempt < DAY_ATTEMPT_LIMIT;
      dAttempt++
    ) {
      const day = pickDayWithAvailableEmployees(input, employeesByDay);
      const candidatesForDay = employeesByDay.get(day.day_id) ?? [];
      const pool =
        candidatesForDay.length > 0 ? candidatesForDay : input.employees;

      for (let eAttempt = 0; eAttempt < EMPLOYEE_ATTEMPT_LIMIT; eAttempt++) {
        const employee = randomFrom(pool);
        const key = `${employee.employee_id}-${day.day_id}`;
        const windows = availabilityByEmployeeDay.get(key) ?? [];
        const booked = bookedIntervalsByEmployeeDay.get(key) ?? [];
        const dayHours = hoursByEmployeeDay.get(key) ?? 0;
        const weekHours = hoursByEmployeeWeek.get(employee.employee_id) ?? 0;

        const validStarts = getConflictFreeStarts(
          employee,
          windows,
          booked,
          durationMin,
          dayHours,
          weekHours,
        );

        if (validStarts.length > 0) {
          chosenDay = day;
          chosenEmployee = employee;
          chosenStart = randomFrom(validStarts);
          break dayAttempts;
        }
      }
    }

    if (chosenDay === null || chosenEmployee === null || chosenStart === null) {
      chosenDay = pickDayWithAvailableEmployees(input, employeesByDay);
      chosenEmployee = pickEmployeeForDay(
        input,
        chosenDay.day_id,
        employeesByDay,
      );
      const slot = pickTimeSlotForEmployeeDay(
        chosenEmployee.employee_id,
        chosenDay.day_id,
        durationHours,
        availabilityByEmployeeDay,
      );
      chosenStart = timeToMinutes(slot.start_time);
    }

    const chosenEnd = chosenStart + durationMin;

    const key = `${chosenEmployee.employee_id}-${chosenDay.day_id}`;
    if (!bookedIntervalsByEmployeeDay.has(key)) {
      bookedIntervalsByEmployeeDay.set(key, []);
    }
    bookedIntervalsByEmployeeDay
      .get(key)!
      .push({ start: chosenStart, end: chosenEnd });
    hoursByEmployeeDay.set(
      key,
      (hoursByEmployeeDay.get(key) ?? 0) + durationMin / 60,
    );
    hoursByEmployeeWeek.set(
      chosenEmployee.employee_id,
      (hoursByEmployeeWeek.get(chosenEmployee.employee_id) ?? 0) +
        durationMin / 60,
    );

    assignments.push({
      course_code: req.course_code,
      section_id: req.section_id,
      employee_id: chosenEmployee.employee_id,
      room_id: room.room_id,
      day_id: chosenDay.day_id,
      start_time: minutesToTime(chosenStart),
      end_time: minutesToTime(chosenEnd),
      session_number: req.session_number,
      session_duration_hours: req.session_duration_hours,
    });
  }

  return assignments;
}

export function initializePopulation(
  populationSize: number,
  requirements: SchedulingRequirement[],
  input: SchedulingInput,
): Candidate[] {
  const population: Candidate[] = [];

  for (let i = 0; i < populationSize; i++) {
    const assignments = generateRandomCandidate(requirements, input);
    const candidate: Candidate = { assignments, fitness: 0 };
    scoreCandidate(candidate, input);
    population.push(candidate);
  }

  return population;
}

const TOURNAMENT_SIZE = 3;

export function tournamentSelect(population: Candidate[]): Candidate {
  let best: Candidate | null = null;

  for (let i = 0; i < TOURNAMENT_SIZE; i++) {
    const contender = randomFrom(population);
    if (best === null || contender.fitness < best.fitness) {
      best = contender;
    }
  }

  return best!;
}

export function crossover(
  parentA: Candidate,
  parentB: Candidate,
  input: SchedulingInput,
): Candidate {
  const childAssignments: ClassAssignment[] = parentA.assignments.map(
    (assignmentFromA, index) => {
      const assignmentFromB = parentB.assignments[index]!;
      return Math.random() < 0.5 ? assignmentFromA : assignmentFromB;
    },
  );

  const child: Candidate = { assignments: childAssignments, fitness: 0 };
  scoreCandidate(child, input);
  return child;
}

const MUTATION_RATE = 0.1;

export function mutate(
  candidate: Candidate,
  input: SchedulingInput,
): Candidate {
  const courseMap = new Map(input.courses.map((c) => [c.course_code, c]));
  const sectionMap = new Map(input.sections.map((s) => [s.section_id, s]));
  const employeeMap = new Map(input.employees.map((e) => [e.employee_id, e]));
  const employeesByDay = buildEmployeesByDay(input);
  const availabilityByEmployeeDay = buildAvailabilityByEmployeeDay(input);

  const original = candidate.assignments;

  function getSiblingBookings(
    employeeId: number,
    dayId: number,
    excludeIndex: number,
  ): {
    intervals: { start: number; end: number }[];
    dayHours: number;
    weekHours: number;
  } {
    const intervals: { start: number; end: number }[] = [];
    let dayHours = 0;
    let weekHours = 0;
    original.forEach((a, idx) => {
      if (idx === excludeIndex) return;
      if (a.employee_id !== employeeId) return;
      const hrs =
        (timeToMinutes(a.end_time) - timeToMinutes(a.start_time)) / 60;
      weekHours += hrs;
      if (a.day_id === dayId) {
        dayHours += hrs;
        intervals.push({
          start: timeToMinutes(a.start_time),
          end: timeToMinutes(a.end_time),
        });
      }
    });
    return { intervals, dayHours, weekHours };
  }

  const mutatedAssignments: ClassAssignment[] = original.map(
    (assignment, index) => {
      if (Math.random() > MUTATION_RATE) {
        return assignment;
      }

      const mutationChoice = Math.floor(Math.random() * 4);
      switch (mutationChoice) {
        case 0: {
          const course = courseMap.get(assignment.course_code);
          const section = sectionMap.get(assignment.section_id);
          const courseType = (
            course?.course_type_description ?? ""
          ).toLowerCase();
          const isLab = courseType === "laboratory";
          const prefersLabRoom = isLab && assignment.session_number === 2;
          const labRooms = input.rooms.filter(
            (r) => r.type?.toLowerCase() === "laboratory",
          );
          const homeRoomNumbers = section
            ? PROGRAM_HOME_LAB_ROOM_NUMBERS[section.program_id]
            : undefined;
          const homeLabRooms = homeRoomNumbers
            ? labRooms.filter((r) => homeRoomNumbers.includes(r.room_number))
            : [];
          const matchingTypeRooms = input.rooms.filter(
            (r) => r.type?.toLowerCase() === courseType,
          );
          const newRoom =
            prefersLabRoom && homeLabRooms.length > 0
              ? randomFrom(homeLabRooms)
              : prefersLabRoom && labRooms.length > 0
                ? randomFrom(labRooms)
                : matchingTypeRooms.length > 0
                  ? randomFrom(matchingTypeRooms)
                  : randomFrom(input.rooms);
          return { ...assignment, room_id: newRoom.room_id };
        }
        case 1: {
          const course = courseMap.get(assignment.course_code);
          const durationHours =
            assignment.session_duration_hours ?? course?.total_hours ?? 1.5;
          const durationMin = Math.round(durationHours * 60);
          const candidatesForDay = employeesByDay.get(assignment.day_id) ?? [];
          const pool =
            candidatesForDay.length > 0 ? candidatesForDay : input.employees;

          let newEmployee: EmployeeData | null = null;
          let newStart: number | null = null;
          for (let attempt = 0; attempt < EMPLOYEE_ATTEMPT_LIMIT; attempt++) {
            const candidateEmployee = randomFrom(pool);
            const key = `${candidateEmployee.employee_id}-${assignment.day_id}`;
            const windows = availabilityByEmployeeDay.get(key) ?? [];
            const { intervals, dayHours, weekHours } = getSiblingBookings(
              candidateEmployee.employee_id,
              assignment.day_id,
              index,
            );
            const validStarts = getConflictFreeStarts(
              candidateEmployee,
              windows,
              intervals,
              durationMin,
              dayHours,
              weekHours,
            );
            if (validStarts.length > 0) {
              newEmployee = candidateEmployee;
              newStart = randomFrom(validStarts);
              break;
            }
          }

          if (newEmployee === null || newStart === null) {
            newEmployee = pickEmployeeForDay(
              input,
              assignment.day_id,
              employeesByDay,
            );
            const slot = pickTimeSlotForEmployeeDay(
              newEmployee.employee_id,
              assignment.day_id,
              durationHours,
              availabilityByEmployeeDay,
            );
            newStart = timeToMinutes(slot.start_time);
          }

          const newEnd = newStart + durationMin;
          return {
            ...assignment,
            employee_id: newEmployee.employee_id,
            start_time: minutesToTime(newStart),
            end_time: minutesToTime(newEnd),
          };
        }
        case 2: {
          const course = courseMap.get(assignment.course_code);
          const durationHours =
            assignment.session_duration_hours ?? course?.total_hours ?? 1.5;
          const durationMin = Math.round(durationHours * 60);

          let newDay: DayData | null = null;
          let newEmployee: EmployeeData | null = null;
          let newStart: number | null = null;

          dayAttempts: for (
            let dAttempt = 0;
            dAttempt < DAY_ATTEMPT_LIMIT;
            dAttempt++
          ) {
            const day = pickDayWithAvailableEmployees(input, employeesByDay);
            const candidatesForDay = employeesByDay.get(day.day_id) ?? [];
            const pool =
              candidatesForDay.length > 0 ? candidatesForDay : input.employees;

            for (
              let eAttempt = 0;
              eAttempt < EMPLOYEE_ATTEMPT_LIMIT;
              eAttempt++
            ) {
              const candidateEmployee = randomFrom(pool);
              const key = `${candidateEmployee.employee_id}-${day.day_id}`;
              const windows = availabilityByEmployeeDay.get(key) ?? [];
              const { intervals, dayHours, weekHours } = getSiblingBookings(
                candidateEmployee.employee_id,
                day.day_id,
                index,
              );
              const validStarts = getConflictFreeStarts(
                candidateEmployee,
                windows,
                intervals,
                durationMin,
                dayHours,
                weekHours,
              );
              if (validStarts.length > 0) {
                newDay = day;
                newEmployee = candidateEmployee;
                newStart = randomFrom(validStarts);
                break dayAttempts;
              }
            }
          }

          if (newDay === null || newEmployee === null || newStart === null) {
            newDay = pickDayWithAvailableEmployees(input, employeesByDay);
            newEmployee = pickEmployeeForDay(
              input,
              newDay.day_id,
              employeesByDay,
            );
            const slot = pickTimeSlotForEmployeeDay(
              newEmployee.employee_id,
              newDay.day_id,
              durationHours,
              availabilityByEmployeeDay,
            );
            newStart = timeToMinutes(slot.start_time);
          }

          const newEnd = newStart + durationMin;
          return {
            ...assignment,
            day_id: newDay.day_id,
            employee_id: newEmployee.employee_id,
            start_time: minutesToTime(newStart),
            end_time: minutesToTime(newEnd),
          };
        }
        default: {
          const course = courseMap.get(assignment.course_code);
          const durationHours =
            assignment.session_duration_hours ?? course?.total_hours ?? 1.5;
          const durationMin = Math.round(durationHours * 60);
          const key = `${assignment.employee_id}-${assignment.day_id}`;
          const windows = availabilityByEmployeeDay.get(key) ?? [];
          const { intervals, dayHours, weekHours } = getSiblingBookings(
            assignment.employee_id,
            assignment.day_id,
            index,
          );
          const employee = employeeMap.get(assignment.employee_id);

          let newStart: number;
          const validStarts = employee
            ? getConflictFreeStarts(
                employee,
                windows,
                intervals,
                durationMin,
                dayHours,
                weekHours,
              )
            : [];
          if (validStarts.length > 0) {
            newStart = randomFrom(validStarts);
          } else {
            const slot = pickTimeSlotForEmployeeDay(
              assignment.employee_id,
              assignment.day_id,
              durationHours,
              availabilityByEmployeeDay,
            );
            newStart = timeToMinutes(slot.start_time);
          }

          const newEnd = newStart + durationMin;
          return {
            ...assignment,
            start_time: minutesToTime(newStart),
            end_time: minutesToTime(newEnd),
          };
        }
      }
    },
  );

  const mutated: Candidate = { assignments: mutatedAssignments, fitness: 0 };
  scoreCandidate(mutated, input);
  return mutated;
}

export interface GAResult {
  best: Candidate;
  generationsRun: number;
  fitnessHistory: number[];
  feasible: boolean;
  hardViolationCount: number;
}

export function runGA(
  requirements: SchedulingRequirement[],
  input: SchedulingInput,
  options: {
    populationSize?: number | undefined;
    maxGenerations?: number | undefined;
  } = {},
): GAResult {
  const populationSize = options.populationSize ?? 50;
  const maxGenerations = options.maxGenerations ?? 200;

  let population = initializePopulation(populationSize, requirements, input);
  const fitnessHistory: number[] = [];

  let generationsRun = 0;

  for (let gen = 0; gen < maxGenerations; gen++) {
    generationsRun = gen + 1;

    const currentBest = population.reduce((best, c) =>
      c.fitness < best.fitness ? c : best,
    );
    fitnessHistory.push(currentBest.fitness);

    if (currentBest.fitness === 0) {
      break;
    }

    const nextPopulation: Candidate[] = [currentBest];

    while (nextPopulation.length < populationSize) {
      const parentA = tournamentSelect(population);
      const parentB = tournamentSelect(population);
      const child = crossover(parentA, parentB, input);
      const mutatedChild = mutate(child, input);
      nextPopulation.push(mutatedChild);
    }

    population = nextPopulation;
  }

  const finalBest = population.reduce((best, c) =>
    c.fitness < best.fitness ? c : best,
  );
  const finalResult = scoreCandidate(finalBest, input);
  const feasible = !hasHardViolations(finalResult.violations);
  const hardViolationCount = finalResult.violations.filter((v) =>
    [
      "ROOM_CONFLICT",
      "EMPLOYEE_CONFLICT",
      "SECTION_CONFLICT",
      "ROOM_CAPACITY_EXCEEDED",
      "EMPLOYEE_UNAVAILABLE",
      "ROOM_TYPE_MISMATCH",
      "EMPLOYEE_MAX_HOURS_EXCEEDED",
    ].includes(v.type),
  ).length;

  return {
    best: finalBest,
    generationsRun,
    fitnessHistory,
    feasible,
    hardViolationCount,
  };
}
