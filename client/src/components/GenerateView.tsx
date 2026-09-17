import { useState, useEffect } from "react";
import { Zap, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

interface GeneratedClass {
  class_id: number;
  start_time: string;
  end_time: string;
  employee_id: number;
  room_id: number;
  section_id: number;
  course_code: string;
  day_id: number;
  schedule_id: number;
}

interface GenerateResult {
  success: boolean;
  fitness: number;
  isConflictFree: boolean;
  generationsRun: number;
  classesCreated: number;
  classes: GeneratedClass[];
  error?: string;
}

interface SummaryCounts {
  rooms: number;
  employees: number;
  courses: number;
  sections: number;
}

export function GenerateView() {
  const [counts, setCounts] = useState<SummaryCounts>({
    rooms: 0,
    employees: 0,
    courses: 0,
    sections: 0,
  });
  const [countsLoading, setCountsLoading] = useState(true);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCounts = async () => {
    setCountsLoading(true);
    try {
      const [roomsRes, employeesRes, coursesRes, sectionsRes] =
        await Promise.all([
          fetch("/api/rooms"),
          fetch("/api/employees"),
          fetch("/api/courses"),
          fetch("/api/sections"),
        ]);
      const [rooms, employees, courses, sections] = await Promise.all([
        roomsRes.json(),
        employeesRes.json(),
        coursesRes.json(),
        sectionsRes.json(),
      ]);
      setCounts({
        rooms: rooms.length,
        employees: employees.length,
        courses: courses.length,
        sections: sections.length,
      });
    } catch (err) {
      console.error("Failed to fetch summary counts", err);
    } finally {
      setCountsLoading(false);
    }
  };

  useEffect(() => {
    fetchCounts();
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/generate-schedule", { method: "POST" });
      const data: GenerateResult = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? "Failed to generate schedule");
        return;
      }
      setResult(data);
    } catch (err) {
      console.error("Failed to generate schedule", err);
      setError("Failed to reach the server. Is the backend running?");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-2xl font-bold">Generate Schedule</h2>
        <p className="text-muted-foreground mt-1">
          Auto-generate a conflict-free timetable using the genetic algorithm
        </p>
      </div>

      <div className="glass-card rounded-xl p-6 space-y-4">
        <h3 className="font-heading font-semibold">Current Data</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="bg-secondary rounded-lg p-3 text-center">
            <p className="text-2xl font-bold">
              {countsLoading ? "…" : counts.employees}
            </p>
            <p className="text-muted-foreground">Employees</p>
          </div>
          <div className="bg-secondary rounded-lg p-3 text-center">
            <p className="text-2xl font-bold">
              {countsLoading ? "…" : counts.rooms}
            </p>
            <p className="text-muted-foreground">Rooms</p>
          </div>
          <div className="bg-secondary rounded-lg p-3 text-center">
            <p className="text-2xl font-bold">
              {countsLoading ? "…" : counts.courses}
            </p>
            <p className="text-muted-foreground">Courses</p>
          </div>
          <div className="bg-secondary rounded-lg p-3 text-center">
            <p className="text-2xl font-bold">
              {countsLoading ? "…" : counts.sections}
            </p>
            <p className="text-muted-foreground">Sections</p>
          </div>
        </div>

        <div className="text-sm text-muted-foreground space-y-1">
          <p>• Requires an active schedule (term) to already exist</p>
          <p>• Room capacity must meet section student count</p>
          <p>• No professor, room, or section double-booking</p>
          <p>• Lab courses go to Laboratory rooms, PE to the Gym, etc.</p>
        </div>

        <Button
          onClick={handleGenerate}
          disabled={generating}
          size="lg"
          className="w-full"
        >
          {generating ? "Generating…" : "Generate Schedule"}
        </Button>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <p className="text-sm text-destructive font-medium">{error}</p>
          </div>
        )}
      </div>

      {result && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="glass-card rounded-xl p-5 flex items-center gap-3">
            {result.isConflictFree ? (
              <CheckCircle className="w-6 h-6 text-success" />
            ) : (
              <AlertTriangle className="w-6 h-6 text-amber" />
            )}
            <div>
              <p className="font-semibold">
                {result.classesCreated} classes scheduled
              </p>
              <p className="text-sm text-muted-foreground">
                {result.isConflictFree
                  ? "Conflict-free schedule found"
                  : `Best schedule found (fitness score: ${result.fitness}) — some soft preferences unmet`}
                {" · "}
                {result.generationsRun} generations
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
