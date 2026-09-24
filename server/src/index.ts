import express, { Request, Response } from "express";
import cors from "cors";
import { pool } from "./db";
import { buildSchedulingInputFromDB } from "./scheduling-data";
import { buildRequirements } from "./ga";
import { runGAInWorker } from "./run-ga-worker";
import bcrypt from "bcrypt";
import { randomInt } from "crypto";
import dotenv from "dotenv";
import multer from "multer";
import * as XLSX from "xlsx";

const upload = multer({ storage: multer.memoryStorage() });

dotenv.config();

const PORT = (process.env as any).PORT || 3000;
dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.post("/employees/import", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  let rows: any[];
  try {
    const wb = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) {
      return res
        .status(400)
        .json({ error: "The uploaded file has no sheets." });
    }
    const sheet = wb.Sheets[sheetName];
    if (!sheet) {
      return res
        .status(400)
        .json({ error: "The uploaded file has no sheets." });
    }
    rows = XLSX.utils.sheet_to_json<any>(sheet);
  } catch {
    return res.status(400).json({
      error:
        "Could not read the Excel file. Make sure it's a valid .xlsx/.xls.",
    });
  }

  const keyOf = (r: any) =>
    `${(r.lname || "").trim()}|${(r.fname || "").trim()}|${(r.mname || "").trim()}`;
  const byEmp = new Map<string, any[]>();
  for (const row of rows) {
    if (!row.lname || !row.fname) continue;
    const key = keyOf(row);
    if (!byEmp.has(key)) byEmp.set(key, []);
    byEmp.get(key)!.push(row);
  }

  const inconsistent: string[] = [];
  for (const [, empRows] of byEmp) {
    const dayVals = new Set(empRows.map((r) => r.max_hours_per_day ?? ""));
    const weekVals = new Set(empRows.map((r) => r.max_hours_per_week ?? ""));
    if (dayVals.size > 1 || weekVals.size > 1) {
      inconsistent.push(`${empRows[0].fname} ${empRows[0].lname}`);
    }
  }

  if (inconsistent.length > 0) {
    return res.status(400).json({
      error: `Inconsistent max_hours values for: ${inconsistent.join(", ")}. Fix the sheet so every row for a professor has the same value, then re-upload.`,
    });
  }

  const dayResult = await pool.query("SELECT day_id, name FROM day");
  const dayMap = new Map<string, number>(
    dayResult.rows.map((r: any) => [r.name, r.day_id]),
  );

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    let inserted = 0;
    const skippedAvailability: string[] = [];
    const unknownDays: string[] = [];

    for (const [, empRows] of byEmp) {
      const first = empRows[0];
      const fullName = `${first.fname} ${first.lname}`;
      const result = await client.query(
        `INSERT INTO employee (department, lname, mname, fname, position, username, max_hours_per_day, max_hours_per_week)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING employee_id`,
        [
          first.department || null,
          first.lname,
          first.mname || null,
          first.fname,
          first.position || null,
          first.username || null,
          first.max_hours_per_day ?? null,
          first.max_hours_per_week ?? null,
        ],
      );
      const empId = result.rows[0].employee_id;
      inserted++;

      for (const row of empRows) {
        if (
          row.availability_day &&
          row.availability_start &&
          row.availability_end
        ) {
          const dayId = dayMap.get(row.availability_day);
          if (!dayId) {
            unknownDays.push(`${fullName} (${row.availability_day})`);
            continue;
          }
          await client.query(
            `INSERT INTO availability (start_time, end_time, day_id, employee_id) VALUES ($1, $2, $3, $4)`,
            [row.availability_start, row.availability_end, dayId, empId],
          );
        } else {
          skippedAvailability.push(fullName);
        }
      }
    }

    await client.query("COMMIT");
    res.json({
      success: true,
      inserted,
      skippedAvailability: [...new Set(skippedAvailability)],
      unknownDays: [...new Set(unknownDays)],
    });
  } catch (err: any) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.post("/courses/import", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  let rows: any[];
  try {
    const wb = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) {
      return res
        .status(400)
        .json({ error: "The uploaded file has no sheets." });
    }
    const sheet = wb.Sheets[sheetName];
    if (!sheet) {
      return res
        .status(400)
        .json({ error: "The uploaded file has no sheets." });
    }
    rows = XLSX.utils.sheet_to_json<any>(sheet);
  } catch {
    return res.status(400).json({
      error:
        "Could not read the Excel file. Make sure it's a valid .xlsx/.xls.",
    });
  }

  const byCode = new Map<string, any[]>();
  for (const row of rows) {
    if (!row.course_code) continue;
    if (!byCode.has(row.course_code)) byCode.set(row.course_code, []);
    byCode.get(row.course_code)!.push(row);
  }

  const courseTypeResult = await pool.query(
    "SELECT course_type_id, course_type_description FROM course_type",
  );
  const courseTypeMap = new Map<string, number>(
    courseTypeResult.rows.map((r: any) => [
      r.course_type_description,
      r.course_type_id,
    ]),
  );

  const programResult = await pool.query(
    "SELECT program_id, description FROM program",
  );
  const programMap = new Map<string, number>(
    programResult.rows.map((r: any) => [r.description, r.program_id]),
  );

  const errors: string[] = [];
  for (const [code, courseRows] of byCode) {
    const descVals = new Set(courseRows.map((r) => r.course_description ?? ""));
    const typeVals = new Set(courseRows.map((r) => r.course_type ?? ""));
    if (descVals.size > 1 || typeVals.size > 1) {
      errors.push(`${code}: course_description/course_type differ across rows`);
      continue;
    }
    for (const row of courseRows) {
      if (!row.program || !row.year_level) {
        errors.push(`${code}: program and year_level are required`);
        continue;
      }
      if (!courseTypeMap.has(row.course_type)) {
        errors.push(`${code}: unknown course_type "${row.course_type}"`);
      }
      if (!programMap.has(row.program)) {
        errors.push(`${code}: unknown program "${row.program}"`);
      }
      if (!YEAR_LEVELS.includes(row.year_level)) {
        errors.push(`${code}: invalid year_level "${row.year_level}"`);
      }
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      error: `Import stopped — fix these and re-upload:\n${[...new Set(errors)].join("\n")}`,
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    let inserted = 0;
    let curriculumInserted = 0;

    for (const [code, courseRows] of byCode) {
      const first = courseRows[0];
      const courseTypeId = courseTypeMap.get(first.course_type);
      await client.query(
        `INSERT INTO course (course_code, course_description, course_type_id) VALUES ($1, $2, $3)`,
        [code, first.course_description, courseTypeId],
      );
      inserted++;

      for (const row of courseRows) {
        const programId = programMap.get(row.program);
        await client.query(
          `INSERT INTO curriculum (year_level, program_id, course_code) VALUES ($1, $2, $3)`,
          [row.year_level, programId, code],
        );
        curriculumInserted++;
      }
    }

    await client.query("COMMIT");
    res.json({ success: true, inserted, curriculumInserted });
  } catch (err: any) {
    await client.query("ROLLBACK");
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});
const YEAR_LEVELS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

app.get("/", (req: Request, res: Response) => {
  res.json({ message: "STI-Sync API is running" });
});
app.get("/schedules", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT schedule_id, academic_year as year, school_term as term, status FROM schedule ORDER BY academic_year DESC, school_term DESC",
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch schedules" });
  }
});

app.put("/schedules/:id/activate", async (req, res) => {
  try {
    const { id } = req.params;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("UPDATE schedule SET status = 'archived'");
      await client.query(
        "UPDATE schedule SET status = 'active' WHERE schedule_id = $1",
        [id],
      );
      await client.query("COMMIT");
      res.json({ success: true });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to activate schedule" });
  }
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

// ---- Change password by email code (Resend) ----
const RESET_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;
let pendingReset: {
  code: string;
  expiresAt: number;
  sentAt: number;
  attempts: number;
} | null = null;

function maskEmail(email: string): string {
  const [user = "", domain = ""] = email.split("@");
  return `${user.charAt(0)}***@${domain}`;
}

app.post("/change-password/request", async (req: Request, res: Response) => {
  const apiKey = (process.env as any).RESEND_API_KEY;
  const to = (process.env as any).ADMIN_EMAIL;
  if (!apiKey || !to) {
    return res.status(500).json({
      success: false,
      error: "Email is not configured on the server",
    });
  }
  if (pendingReset && Date.now() - pendingReset.sentAt < RESEND_COOLDOWN_MS) {
    return res.status(429).json({
      success: false,
      error: "Please wait a minute before requesting another code",
    });
  }

  const code = String(randomInt(100000, 1000000));
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from:
          (process.env as any).RESEND_FROM ||
          "STI-Sync <onboarding@resend.dev>",
        to: [to],
        subject: "STI-Sync password change code",
        html: `<p>Your STI-Sync verification code is:</p>
<p style="font-size:24px;font-weight:bold;letter-spacing:4px">${code}</p>
<p>It expires in 10 minutes. If you did not request this, ignore this email.</p>`,
      }),
    });
    if (!r.ok) {
      console.error("Resend error:", await r.text());
      return res
        .status(502)
        .json({ success: false, error: "Could not send the email" });
    }
    pendingReset = {
      code,
      expiresAt: Date.now() + RESET_TTL_MS,
      sentAt: Date.now(),
      attempts: 0,
    };
    res.json({ success: true, sentTo: maskEmail(to) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Could not send the email" });
  }
});

app.put("/change-password/confirm", async (req: Request, res: Response) => {
  const { code, new_password } = req.body;
  if (!code || !new_password) {
    return res
      .status(400)
      .json({ success: false, error: "Code and new password are required" });
  }
  if (String(new_password).length < 8) {
    return res.status(400).json({
      success: false,
      error: "New password must be at least 8 characters",
    });
  }
  if (!pendingReset || Date.now() > pendingReset.expiresAt) {
    pendingReset = null;
    return res.status(400).json({
      success: false,
      error: "Code expired. Request a new one.",
    });
  }
  pendingReset.attempts += 1;
  if (pendingReset.attempts > MAX_CODE_ATTEMPTS) {
    pendingReset = null;
    return res.status(429).json({
      success: false,
      error: "Too many attempts. Request a new code.",
    });
  }
  if (String(code) !== pendingReset.code) {
    return res.status(401).json({ success: false, error: "Incorrect code" });
  }
  try {
    const result = await pool.query("SELECT id FROM login LIMIT 1");
    const hash = await bcrypt.hash(String(new_password), 10);
    if (result.rows.length === 0) {
      await pool.query("INSERT INTO login (password_hash) VALUES ($1)", [hash]);
    } else {
      await pool.query("UPDATE login SET password_hash = $1 WHERE id = $2", [
        hash,
        result.rows[0].id,
      ]);
    }
    pendingReset = null;
    res.json({ success: true });
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
      "SELECT * FROM section WHERE schedule_id = (SELECT schedule_id FROM schedule WHERE status = 'active' LIMIT 1) ORDER BY section_id",
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to fetch sections" });
  }
});
app.post("/sections", async (req: Request, res: Response) => {
  const { number_of_students, year_level, program_id, section_name } = req.body;
  if (!YEAR_LEVELS.includes(year_level)) {
    return res
      .status(400)
      .json({ success: false, error: "Invalid year level" });
  }
  try {
    const result = await pool.query(
      `INSERT INTO section (number_of_students, year_level, program_id, section_name, schedule_id)
 VALUES ($1, $2, $3, $4, (SELECT schedule_id FROM schedule WHERE status = 'active' LIMIT 1))
 RETURNING *`,
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
  } catch (err: any) {
    if (err.code === "23505") {
      return res.status(409).json({
        success: false,
        error: "A program with this name already exists.",
      });
    }
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
  if (!YEAR_LEVELS.includes(year_level)) {
    return res
      .status(400)
      .json({ success: false, error: "Invalid year level" });
  }
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
      "INSERT INTO schedule (academic_year, school_term, status, start_date, end_date) VALUES ($1, $2, 'archived', $3, $4) RETURNING *",
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
  } catch (err: any) {
    if (err.code === "23505") {
      return res.status(409).json({
        success: false,
        error: "A program with this name already exists.",
      });
    }
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
  if (!YEAR_LEVELS.includes(year_level)) {
    return res
      .status(400)
      .json({ success: false, error: "Invalid year level" });
  }
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
  if (!YEAR_LEVELS.includes(year_level)) {
    return res
      .status(400)
      .json({ success: false, error: "Invalid year level" });
  }
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
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM curriculum WHERE course_code = $1", [code]);
    const result = await client.query(
      "DELETE FROM course WHERE course_code = $1 RETURNING *",
      [code],
    );
    if (result.rows.length === 0) {
      await client.query("ROLLBACK");
      return res
        .status(404)
        .json({ success: false, error: "Course not found" });
    }
    await client.query("COMMIT");
    res.json({ success: true, deleted: result.rows[0] });
  } catch (err: any) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(err);
    if (err.code === "23503" || err.code === "23001") {
      return res.status(409).json({
        success: false,
        error:
          "This course is used by scheduled classes. Regenerate or remove them first.",
      });
    }
    res.status(500).json({ success: false, error: "Failed to delete course" });
  } finally {
    client.release();
  }
});
app.delete("/sections/:id", async (req: Request, res: Response) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM class WHERE section_id = $1", [id]);
    const result = await client.query(
      "DELETE FROM section WHERE section_id = $1 RETURNING *",
      [id],
    );
    if (result.rows.length === 0) {
      await client.query("ROLLBACK");
      return res
        .status(404)
        .json({ success: false, error: "Section not found" });
    }
    await client.query("COMMIT");
    res.json({ success: true, deleted: result.rows[0] });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(err);
    res.status(500).json({ success: false, error: "Failed to delete section" });
  } finally {
    client.release();
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
