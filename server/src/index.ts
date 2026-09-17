import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { pool } from "./db";
import { buildSchedulingInputFromDB } from "./scheduling-data";
import { buildRequirements } from "./ga";
import { runGAInWorker } from "./run-ga-worker";
import bcrypt from "bcrypt";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get("/", (req: Request, res: Response) => {
  res.json({ message: "STI-Sync API is running" });
});

app.post("/login", async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res
        .status(400)
        .json({ success: false, error: "Password required" });
    }

    const result = await pool.query("SELECT password_hash FROM login LIMIT 1");

    if (result.rows.length === 0) {
      return res
        .status(401)
        .json({ success: false, error: "Invalid password" });
    }

    const storedHash = result.rows[0].password_hash;
    const match = await bcrypt.compare(password, storedHash);

    if (match) {
      return res.json({ success: true, token: "auth-token-" + Date.now() });
    } else {
      return res
        .status(401)
        .json({ success: false, error: "Invalid password" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

app.get("/test-db", async (req: Request, res: Response) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({ success: true, time: result.rows[0] });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ success: false, error: "Database connection failed" });
  }
});

app.get("/rooms", async (req: Request, res: Response) => {
  try {
    const result = await pool.query("SELECT * FROM room ORDER BY room_number");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to fetch rooms" });
  }
});

app.get("/programs", async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      "SELECT * FROM program ORDER BY program_id",
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to fetch programs" });
  }
});

app.get("/days", async (req: Request, res: Response) => {
  try {
    const result = await pool.query("SELECT * FROM day ORDER BY day_id");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to fetch days" });
  }
});
app.get("/course-types", async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      "SELECT * FROM course_type ORDER BY course_type_id",
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch course types" });
  }
});

app.get("/employees", async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      "SELECT * FROM employee ORDER BY employee_id",
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch employees" });
  }
});

app.get("/courses", async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      "SELECT * FROM course ORDER BY course_code",
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to fetch courses" });
  }
});

app.get("/sections", async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      "SELECT * FROM section ORDER BY section_id",
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to fetch sections" });
  }
});
app.post("/sections", async (req: Request, res: Response) => {
  const { number_of_students, year_level, program_id, section_name } = req.body;
  try {
    const result = await pool.query(
      "INSERT INTO section (number_of_students, year_level, program_id, section_name) VALUES ($1, $2, $3, $4) RETURNING *",
      [number_of_students, year_level, program_id, section_name || null],
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to create section" });
  }
});

app.get("/curriculum", async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      "SELECT * FROM curriculum ORDER BY curriculum_id",
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch curriculum" });
  }
});

app.get("/schedules", async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      "SELECT * FROM schedule ORDER BY schedule_id",
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch schedules" });
  }
});

app.get("/availability", async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      "SELECT * FROM availability ORDER BY availability_id",
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch availability" });
  }
});

app.get("/classes", async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT 
        c.class_id,
        c.employee_id,
        c.room_id,
        c.day_id,
        c.schedule_id,
        c.start_time,
        c.end_time,
        e.name AS professor,
        r.room_number AS room,
        sec.section_id,
        sec.year_level,
        p.description AS program,
        co.course_code,
        co.course_description AS course,
        d.name AS day,
        s.academic_year,
        s.school_term
      FROM class c
      JOIN employee e ON c.employee_id = e.employee_id
      JOIN room r ON c.room_id = r.room_id
      JOIN section sec ON c.section_id = sec.section_id
      JOIN program p ON sec.program_id = p.program_id
      JOIN course co ON c.course_code = co.course_code
      JOIN day d ON c.day_id = d.day_id
      JOIN schedule s ON c.schedule_id = s.schedule_id
      WHERE s.status = 'active'
      ORDER BY d.day_id, c.start_time
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to fetch classes" });
  }
});

app.post("/rooms", async (req: Request, res: Response) => {
  const { room_number, capacity, type } = req.body;
  try {
    const result = await pool.query(
      "INSERT INTO room (room_number, capacity, type) VALUES ($1, $2, $3) RETURNING *",
      [room_number, capacity, type],
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to create room" });
  }
});

app.post("/programs", async (req: Request, res: Response) => {
  const { description } = req.body;
  try {
    const result = await pool.query(
      "INSERT INTO program (description) VALUES ($1) RETURNING *",
      [description],
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to create program" });
  }
});

app.post("/days", async (req: Request, res: Response) => {
  const { name } = req.body;
  try {
    const result = await pool.query(
      "INSERT INTO day (name) VALUES ($1) RETURNING *",
      [name],
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to create day" });
  }
});

app.post("/course-types", async (req: Request, res: Response) => {
  const { course_type_description, total_hours } = req.body;
  try {
    const result = await pool.query(
      "INSERT INTO course_type (course_type_description, total_hours) VALUES ($1, $2) RETURNING *",
      [course_type_description, total_hours],
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ success: false, error: "Failed to create course type" });
  }
});

app.post("/employees", async (req: Request, res: Response) => {
  const {
    department,
    lname,
    mname,
    fname,
    position,
    username,
    max_hours_per_day,
    max_hours_per_week,
  } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO employee
        (department, lname, mname, fname, position, username, max_hours_per_day, max_hours_per_week)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        department,
        lname,
        mname,
        fname,
        position,
        username || null,
        max_hours_per_day ?? null,
        max_hours_per_week ?? null,
      ],
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ success: false, error: "Failed to create employee" });
  }
});

app.post("/courses", async (req: Request, res: Response) => {
  const { course_code, course_description, course_type_id } = req.body;
  try {
    const result = await pool.query(
      "INSERT INTO course (course_code, course_description, course_type_id) VALUES ($1, $2, $3) RETURNING *",
      [course_code, course_description, course_type_id],
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to create course" });
  }
});

app.post("/curriculum", async (req: Request, res: Response) => {
  const { year_level, program_id, course_code } = req.body;
  try {
    const result = await pool.query(
      "INSERT INTO curriculum (year_level, program_id, course_code) VALUES ($1, $2, $3) RETURNING *",
      [year_level, program_id, course_code],
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ success: false, error: "Failed to create curriculum entry" });
  }
});

app.post("/schedules", async (req: Request, res: Response) => {
  const { academic_year, school_term, start_date, end_date } = req.body;
  try {
    const result = await pool.query(
      "INSERT INTO schedule (academic_year, school_term, start_date, end_date) VALUES ($1, $2, $3, $4) RETURNING *",
      [academic_year, school_term, start_date, end_date],
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ success: false, error: "Failed to create schedule" });
  }
});

app.post("/availability", async (req: Request, res: Response) => {
  const { start_time, end_time, day_id, employee_id } = req.body;
  try {
    const result = await pool.query(
      "INSERT INTO availability (start_time, end_time, day_id, employee_id) VALUES ($1, $2, $3, $4) RETURNING *",
      [start_time, end_time, day_id, employee_id],
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ success: false, error: "Failed to create availability" });
  }
});

app.post("/classes", async (req: Request, res: Response) => {
  const {
    start_time,
    end_time,
    employee_id,
    room_id,
    section_id,
    course_code,
    day_id,
    schedule_id,
  } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO class (start_time, end_time, employee_id, room_id, section_id, course_code, day_id, schedule_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        start_time,
        end_time,
        employee_id,
        room_id,
        section_id,
        course_code,
        day_id,
        schedule_id,
      ],
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to create class" });
  }
});

app.put("/rooms/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  const { room_number, capacity, type } = req.body;
  try {
    const result = await pool.query(
      "UPDATE room SET room_number = $1, capacity = $2, type = $3 WHERE room_id = $4 RETURNING *",
      [room_number, capacity, type, id],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Room not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to update room" });
  }
});
app.put("/programs/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  const { description } = req.body;
  try {
    const result = await pool.query(
      "UPDATE program SET description = $1 WHERE program_id = $2 RETURNING *",
      [description, id],
    );
    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Program not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to update program" });
  }
});

app.put("/course-types/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  const { course_type_description, total_hours } = req.body;
  try {
    const result = await pool.query(
      "UPDATE course_type SET course_type_description = $1, total_hours = $2 WHERE course_type_id = $3 RETURNING *",
      [course_type_description, total_hours, id],
    );
    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Course type not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ success: false, error: "Failed to update course type" });
  }
});

app.put("/employees/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    department,
    lname,
    mname,
    fname,
    position,
    username,
    max_hours_per_day,
    max_hours_per_week,
  } = req.body;
  try {
    const result = await pool.query(
      `UPDATE employee
       SET department = $1, lname = $2, mname = $3, fname = $4, position = $5,
           username = $6, max_hours_per_day = $7, max_hours_per_week = $8
       WHERE employee_id = $9 RETURNING *`,
      [
        department,
        lname,
        mname,
        fname,
        position,
        username || null,
        max_hours_per_day ?? null,
        max_hours_per_week ?? null,
        id,
      ],
    );
    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Employee not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ success: false, error: "Failed to update employee" });
  }
});

app.put("/courses/:code", async (req: Request, res: Response) => {
  const { code } = req.params;
  const { course_description, course_type_id } = req.body;
  try {
    const result = await pool.query(
      "UPDATE course SET course_description = $1, course_type_id = $2 WHERE course_code = $3 RETURNING *",
      [course_description, course_type_id, code],
    );
    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Course not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to update course" });
  }
});

app.put("/sections/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  const { number_of_students, year_level, program_id, section_name } = req.body;
  try {
    const result = await pool.query(
      "UPDATE section SET number_of_students = $1, year_level = $2, program_id = $3, section_name = $4 WHERE section_id = $5 RETURNING *",
      [number_of_students, year_level, program_id, section_name || null, id],
    );
    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Section not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to update section" });
  }
});
app.put("/curriculum/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  const { year_level, program_id, course_code } = req.body;
  try {
    const result = await pool.query(
      "UPDATE curriculum SET year_level = $1, program_id = $2, course_code = $3 WHERE curriculum_id = $4 RETURNING *",
      [year_level, program_id, course_code, id],
    );
    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Curriculum entry not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ success: false, error: "Failed to update curriculum entry" });
  }
});

app.put("/schedules/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  const { academic_year, school_term, status, start_date, end_date } = req.body;
  try {
    const result = await pool.query(
      "UPDATE schedule SET academic_year = $1, school_term = $2, status = $3, start_date = $4, end_date = $5 WHERE schedule_id = $6 RETURNING *",
      [academic_year, school_term, status, start_date, end_date, id],
    );
    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Schedule not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ success: false, error: "Failed to update schedule" });
  }
});

app.put("/availability/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  const { start_time, end_time, day_id, employee_id } = req.body;
  try {
    const result = await pool.query(
      "UPDATE availability SET start_time = $1, end_time = $2, day_id = $3, employee_id = $4 WHERE availability_id = $5 RETURNING *",
      [start_time, end_time, day_id, employee_id, id],
    );
    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Availability not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ success: false, error: "Failed to update availability" });
  }
});

app.put("/classes/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    start_time,
    end_time,
    employee_id,
    room_id,
    section_id,
    course_code,
    day_id,
    schedule_id,
  } = req.body;
  try {
    const result = await pool.query(
      `UPDATE class 
       SET start_time = $1, end_time = $2, employee_id = $3, room_id = $4, section_id = $5, course_code = $6, day_id = $7, schedule_id = $8 
       WHERE class_id = $9 RETURNING *`,
      [
        start_time,
        end_time,
        employee_id,
        room_id,
        section_id,
        course_code,
        day_id,
        schedule_id,
        id,
      ],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Class not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to update class" });
  }
});

app.delete("/rooms/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      "DELETE FROM room WHERE room_id = $1 RETURNING *",
      [id],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Room not found" });
    }
    res.json({ success: true, deleted: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to delete room" });
  }
});

app.delete("/programs/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      "DELETE FROM program WHERE program_id = $1 RETURNING *",
      [id],
    );
    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Program not found" });
    }
    res.json({ success: true, deleted: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to delete program" });
  }
});

app.delete("/course-types/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      "DELETE FROM course_type WHERE course_type_id = $1 RETURNING *",
      [id],
    );
    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Course type not found" });
    }
    res.json({ success: true, deleted: result.rows[0] });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ success: false, error: "Failed to delete course type" });
  }
});

app.delete("/employees/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      "DELETE FROM employee WHERE employee_id = $1 RETURNING *",
      [id],
    );
    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Employee not found" });
    }
    res.json({ success: true, deleted: result.rows[0] });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ success: false, error: "Failed to delete employee" });
  }
});

app.delete("/courses/:code", async (req: Request, res: Response) => {
  const { code } = req.params;
  try {
    const result = await pool.query(
      "DELETE FROM course WHERE course_code = $1 RETURNING *",
      [code],
    );
    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Course not found" });
    }
    res.json({ success: true, deleted: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to delete course" });
  }
});

app.delete("/sections/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      "DELETE FROM section WHERE section_id = $1 RETURNING *",
      [id],
    );
    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Section not found" });
    }
    res.json({ success: true, deleted: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to delete section" });
  }
});

app.delete("/curriculum/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      "DELETE FROM curriculum WHERE curriculum_id = $1 RETURNING *",
      [id],
    );
    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Curriculum entry not found" });
    }
    res.json({ success: true, deleted: result.rows[0] });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ success: false, error: "Failed to delete curriculum entry" });
  }
});
app.delete("/schedules/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      "DELETE FROM schedule WHERE schedule_id = $1 RETURNING *",
      [id],
    );
    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Schedule not found" });
    }
    res.json({ success: true, deleted: result.rows[0] });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ success: false, error: "Failed to delete schedule" });
  }
});

app.delete("/availability/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      "DELETE FROM availability WHERE availability_id = $1 RETURNING *",
      [id],
    );
    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, error: "Availability not found" });
    }
    res.json({ success: true, deleted: result.rows[0] });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ success: false, error: "Failed to delete availability" });
  }
});

app.delete("/classes/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      "DELETE FROM class WHERE class_id = $1 RETURNING *",
      [id],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Class not found" });
    }
    res.json({ success: true, deleted: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to delete class" });
  }
});

app.post("/generate-schedule", async (req: Request, res: Response) => {
  const client = await pool.connect();

  try {
    const activeScheduleResult = await pool.query(
      "SELECT schedule_id FROM schedule WHERE status = 'active' LIMIT 1",
    );

    if (activeScheduleResult.rows.length === 0) {
      client.release();
      return res.status(400).json({
        success: false,
        error: "No active schedule found. Create an active schedule first.",
      });
    }

    const scheduleId = activeScheduleResult.rows[0].schedule_id;

    const input = await buildSchedulingInputFromDB(scheduleId);
    const requirements = buildRequirements(input);

    if (requirements.length === 0) {
      client.release();
      return res.status(400).json({
        success: false,
        error:
          "No scheduling requirements found. Check that curriculum entries match section program_id + year_level.",
      });
    }

    const gaResult = await runGAInWorker(input, 50, 200);

    await client.query("BEGIN");

    await client.query("DELETE FROM class WHERE schedule_id = $1", [
      scheduleId,
    ]);

    const insertedClasses = [];
    for (const assignment of gaResult.best.assignments) {
      const insertResult = await client.query(
        `INSERT INTO class (start_time, end_time, employee_id, room_id, section_id, course_code, day_id, schedule_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [
          assignment.start_time,
          assignment.end_time,
          assignment.employee_id,
          assignment.room_id,
          assignment.section_id,
          assignment.course_code,
          assignment.day_id,
          scheduleId,
        ],
      );
      insertedClasses.push(insertResult.rows[0]);
    }

    await client.query("COMMIT");
    client.release();

    res.json({
      success: true,
      fitness: gaResult.best.fitness,
      isConflictFree: gaResult.best.fitness === 0,
      generationsRun: gaResult.generationsRun,
      classesCreated: insertedClasses.length,
      classes: insertedClasses,
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    client.release();
    console.error(err);
    const message =
      err instanceof Error ? err.message : "Failed to generate schedule";
    res.status(500).json({ success: false, error: message });
  }
});
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
