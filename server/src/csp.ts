import { PROGRAM_HOME_LAB_ROOM_NUMBERS } from "./types";
import {
  Candidate,
  ClassAssignment,
  ConstraintViolation,
  FitnessResult,
  SchedulingInput,
  RoomData,
  SectionData,
  AvailabilityData,
} from "./types";

const WEIGHTS = {
  ROOM_CONFLICT: 100,
  EMPLOYEE_CONFLICT: 100,
  SECTION_CONFLICT: 100,
  ROOM_CAPACITY_EXCEEDED: 50,
  EMPLOYEE_UNAVAILABLE: 75,
  ROOM_TYPE_MISMATCH: 60,
  EMPLOYEE_MAX_HOURS_EXCEEDED: 65,
  HOME_LAB_PREFERENCE_UNMET: 15,
  LAB_PREFERENCE_UNMET: 15,
  LONG_VACANT_GAP_PER_30MIN: 5,
};
const HARD_VIOLATION_TYPES = new Set<ConstraintViolation["type"]>([
  "ROOM_CONFLICT",
  "EMPLOYEE_CONFLICT",
  "SECTION_CONFLICT",
  "ROOM_CAPACITY_EXCEEDED",
  "EMPLOYEE_UNAVAILABLE",
  "ROOM_TYPE_MISMATCH",
  "EMPLOYEE_MAX_HOURS_EXCEEDED",
]);

export function hasHardViolations(violations: ConstraintViolation[]): boolean {
  return violations.some((v) => HARD_VIOLATION_TYPES.has(v.type));
}

function toMinutes(time: string): number {
  const parts = time.split(":").map(Number);
  const h = parts[0] ?? 0;
  const m = parts[1] ?? 0;
  return h * 60 + m;
}

function timesOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string,
): boolean {
  const aStart = toMinutes(startA);
  const aEnd = toMinutes(endA);
  const bStart = toMinutes(startB);
  const bEnd = toMinutes(endB);
  return aStart < bEnd && bStart < aEnd;
}

export function evaluateFitness(
  assignments: ClassAssignment[],
  input: SchedulingInput,
): FitnessResult {
  const violations: ConstraintViolation[] = [];

  const roomMap = new Map<number, RoomData>(
    input.rooms.map((r) => [r.room_id, r]),
  );
  const sectionMap = new Map<number, SectionData>(
    input.sections.map((s) => [s.section_id, s]),
  );
  const courseMap = new Map(input.courses.map((c) => [c.course_code, c]));

  const availabilityByEmployeeDay = new Map<string, AvailabilityData[]>();
  for (const a of input.availability) {
    const key = `${a.employee_id}-${a.day_id}`;
    if (!availabilityByEmployeeDay.has(key)) {
      availabilityByEmployeeDay.set(key, []);
    }
    availabilityByEmployeeDay.get(key)!.push(a);
  }

  for (let i = 0; i < assignments.length; i++) {
    for (let j = i + 1; j < assignments.length; j++) {
      const a = assignments[i]!;
      const b = assignments[j]!;

      if (a.day_id !== b.day_id) continue;

      const overlaps = timesOverlap(
        a.start_time,
        a.end_time,
        b.start_time,
        b.end_time,
      );
      if (!overlaps) continue;

      if (a.room_id === b.room_id) {
        violations.push({
          type: "ROOM_CONFLICT",
          message: `Room ${a.room_id} double-booked on day ${a.day_id} between (${a.course_code}) and (${b.course_code})`,
          weight: WEIGHTS.ROOM_CONFLICT,
        });
      }

      if (a.employee_id === b.employee_id) {
        violations.push({
          type: "EMPLOYEE_CONFLICT",
          message: `Employee ${a.employee_id} double-booked on day ${a.day_id} between (${a.course_code}) and (${b.course_code})`,
          weight: WEIGHTS.EMPLOYEE_CONFLICT,
        });
      }

      if (a.section_id === b.section_id) {
        violations.push({
          type: "SECTION_CONFLICT",
          message: `Section ${a.section_id} double-booked on day ${a.day_id} between (${a.course_code}) and (${b.course_code})`,
          weight: WEIGHTS.SECTION_CONFLICT,
        });
      }
    }
  }

  for (const assignment of assignments) {
    const room = roomMap.get(assignment.room_id);
    const section = sectionMap.get(assignment.section_id);

    if (room && section && section.number_of_students > room.capacity) {
      violations.push({
        type: "ROOM_CAPACITY_EXCEEDED",
        message: `Section ${assignment.section_id} (${section.number_of_students} students) exceeds Room ${room.room_number} capacity (${room.capacity})`,
        weight: WEIGHTS.ROOM_CAPACITY_EXCEEDED,
      });
    }

    const course = courseMap.get(assignment.course_code);
    if (room && course && room.type) {
      const courseType = course.course_type_description.toLowerCase();
      const roomType = room.type.toLowerCase();

      if (courseType !== roomType) {
        violations.push({
          type: "ROOM_TYPE_MISMATCH",
          message: `Course ${assignment.course_code} (${course.course_type_description}) assigned to Room ${room.room_number} (${room.type})`,
          weight: WEIGHTS.ROOM_TYPE_MISMATCH,
        });
      }

      const section = sectionMap.get(assignment.section_id);
      const homeRoomNumbers = section
        ? PROGRAM_HOME_LAB_ROOM_NUMBERS[section.program_id]
        : undefined;
      if (
        room &&
        course &&
        room.type &&
        course.course_type_description.toLowerCase() === "laboratory" &&
        assignment.session_number === 2 &&
        homeRoomNumbers &&
        !homeRoomNumbers.includes(room.room_number)
      ) {
        violations.push({
          type: "HOME_LAB_PREFERENCE_UNMET",
          message: `Session 2 of ${assignment.course_code} (Section ${assignment.section_id}) assigned to Room ${room.room_number} instead of a home lab (${homeRoomNumbers.join(", ")})`,
          weight: WEIGHTS.HOME_LAB_PREFERENCE_UNMET,
        });
      }

      if (
        room &&
        course &&
        room.type &&
        course.course_type_description.toLowerCase() === "laboratory" &&
        assignment.session_number === 2 &&
        room.type.toLowerCase() !== "laboratory"
      ) {
        violations.push({
          type: "LAB_PREFERENCE_UNMET",
          message: `Session 2 of ${assignment.course_code} (Laboratory) assigned to Room ${room.room_number} (${room.type}) instead of a Laboratory room`,
          weight: WEIGHTS.LAB_PREFERENCE_UNMET,
        });
      }
    }

    const key = `${assignment.employee_id}-${assignment.day_id}`;
    const employeeAvailability = availabilityByEmployeeDay.get(key) || [];

    const isWithinAvailability = employeeAvailability.some((avail) => {
      const assignStart = toMinutes(assignment.start_time);
      const assignEnd = toMinutes(assignment.end_time);
      const availStart = toMinutes(avail.start_time);
      const availEnd = toMinutes(avail.end_time);
      return assignStart >= availStart && assignEnd <= availEnd;
    });

    if (!isWithinAvailability) {
      violations.push({
        type: "EMPLOYEE_UNAVAILABLE",
        message:
          employeeAvailability.length === 0
            ? `Employee ${assignment.employee_id} has no declared availability on day ${assignment.day_id}`
            : `Employee ${assignment.employee_id} assigned outside declared availability on day ${assignment.day_id}`,
        weight: WEIGHTS.EMPLOYEE_UNAVAILABLE,
      });
    }
  }

  const employeeMap = new Map(input.employees.map((e) => [e.employee_id, e]));

  function durationHours(assignment: ClassAssignment): number {
    return (
      (toMinutes(assignment.end_time) - toMinutes(assignment.start_time)) / 60
    );
  }

  const hoursByEmployeeDay = new Map<string, number>();
  const hoursByEmployeeWeek = new Map<number, number>();

  for (const assignment of assignments) {
    const dayKey = `${assignment.employee_id}-${assignment.day_id}`;
    const hours = durationHours(assignment);
    hoursByEmployeeDay.set(
      dayKey,
      (hoursByEmployeeDay.get(dayKey) ?? 0) + hours,
    );
    hoursByEmployeeWeek.set(
      assignment.employee_id,
      (hoursByEmployeeWeek.get(assignment.employee_id) ?? 0) + hours,
    );
  }

  for (const [dayKey, totalHours] of hoursByEmployeeDay) {
    const [employeeIdStr, dayIdStr] = dayKey.split("-");
    const employeeId = Number(employeeIdStr);
    const employee = employeeMap.get(employeeId);
    if (
      employee?.max_hours_per_day != null &&
      totalHours > employee.max_hours_per_day
    ) {
      violations.push({
        type: "EMPLOYEE_MAX_HOURS_EXCEEDED",
        message: `Employee ${employeeId} scheduled ${totalHours}hrs on day ${dayIdStr}, exceeding their daily max of ${employee.max_hours_per_day}hrs`,
        weight: WEIGHTS.EMPLOYEE_MAX_HOURS_EXCEEDED,
      });
    }
  }

  for (const [employeeId, totalHours] of hoursByEmployeeWeek) {
    const employee = employeeMap.get(employeeId);
    if (
      employee?.max_hours_per_week != null &&
      totalHours > employee.max_hours_per_week
    ) {
      violations.push({
        type: "EMPLOYEE_MAX_HOURS_EXCEEDED",
        message: `Employee ${employeeId} scheduled ${totalHours}hrs this week, exceeding their weekly max of ${employee.max_hours_per_week}hrs`,
        weight: WEIGHTS.EMPLOYEE_MAX_HOURS_EXCEEDED,
      });
    }
  }

  const GAP_GRACE_MINUTES = 30;

  const assignmentsBySectionDay = new Map<string, ClassAssignment[]>();
  for (const assignment of assignments) {
    const key = `${assignment.section_id}-${assignment.day_id}`;
    if (!assignmentsBySectionDay.has(key)) {
      assignmentsBySectionDay.set(key, []);
    }
    assignmentsBySectionDay.get(key)!.push(assignment);
  }

  for (const [key, dayAssignments] of assignmentsBySectionDay) {
    if (dayAssignments.length < 2) continue;
    const sorted = [...dayAssignments].sort(
      (a, b) => toMinutes(a.start_time) - toMinutes(b.start_time),
    );
    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i]!;
      const next = sorted[i + 1]!;
      const gapMinutes =
        toMinutes(next.start_time) - toMinutes(current.end_time);
      if (gapMinutes > GAP_GRACE_MINUTES) {
        const excessMinutes = gapMinutes - GAP_GRACE_MINUTES;
        const penaltyUnits = Math.ceil(excessMinutes / 30);
        const [sectionIdStr, dayIdStr] = key.split("-");
        violations.push({
          type: "LONG_VACANT_GAP",
          message: `Section ${sectionIdStr} has a ${gapMinutes}-minute gap on day ${dayIdStr} between (${current.course_code}) and (${next.course_code})`,
          weight: penaltyUnits * WEIGHTS.LONG_VACANT_GAP_PER_30MIN,
        });
      }
    }
  }
  const fitness = violations.reduce((sum, v) => sum + v.weight, 0);

  return { fitness, violations };
}

export function scoreCandidate(
  candidate: Candidate,
  input: SchedulingInput,
): FitnessResult {
  const result = evaluateFitness(candidate.assignments, input);
  candidate.fitness = result.fitness;
  return result;
}
