import { pool } from "./db";
import { SchedulingInput } from "./types";

export async function buildSchedulingInputFromDB(
  scheduleId: number,
): Promise<SchedulingInput> {
  const [
    roomsResult,
    employeesResult,
    sectionsResult,
    coursesResult,
    curriculumResult,
    availabilityResult,
    daysResult,
  ] = await Promise.all([
    pool.query("SELECT room_id, room_number, capacity, type FROM room"),
    pool.query(
      "SELECT employee_id, department, name, max_hours_per_day, max_hours_per_week FROM employee",
    ),
    pool.query(
      "SELECT section_id, number_of_students, year_level, program_id FROM section",
    ),
    pool.query(`
      SELECT
        c.course_code,
        c.course_description,
        c.course_type_id,
        ct.course_type_description,
        ct.total_hours
      FROM course c
      JOIN course_type ct ON c.course_type_id = ct.course_type_id
    `),
    pool.query(
      "SELECT curriculum_id, year_level, program_id, course_code FROM curriculum",
    ),
    pool.query(
      "SELECT availability_id, employee_id, day_id, start_time, end_time FROM availability",
    ),
    pool.query("SELECT day_id, name FROM day"),
  ]);

  return {
    rooms: roomsResult.rows,
    employees: employeesResult.rows,
    sections: sectionsResult.rows,
    courses: coursesResult.rows,
    curriculum: curriculumResult.rows,
    availability: availabilityResult.rows,
    days: daysResult.rows,
    schedule_id: scheduleId,
  };
}
