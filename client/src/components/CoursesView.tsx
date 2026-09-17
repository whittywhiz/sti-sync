import { useState, useMemo, useEffect } from "react";
import { Plus, Trash2, Pencil, Check, X, Search, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";

// Matches your real `course` table
interface Course {
  course_code: string;
  course_description: string;
  course_type_id: number;
}

// Matches your real `course_type` table
interface CourseType {
  course_type_id: number;
  course_type_description: string;
  total_hours: number;
}

// Matches your real `program` table
interface Program {
  program_id: number;
  description: string;
}

// Matches your real `curriculum` table
interface Curriculum {
  curriculum_id: number;
  year_level: string;
  program_id: number;
  course_code: string;
}

interface Placement {
  program_id: number;
  year_level: string;
}

interface CourseFormValues {
  course_code: string;
  course_description: string;
  course_type_id: number | "";
  placements: Placement[];
}

interface CourseFormProps {
  initial: CourseFormValues;
  programs: Program[];
  courseTypes: CourseType[];
  onSave: (v: CourseFormValues) => void;
  onCancel: () => void;
}

const YEAR_LEVELS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

function CourseForm({
  initial,
  programs,
  courseTypes,
  onSave,
  onCancel,
}: CourseFormProps) {
  const [courseCode, setCourseCode] = useState(initial.course_code);
  const [description, setDescription] = useState(initial.course_description);
  const [courseTypeId, setCourseTypeId] = useState<number | "">(
    initial.course_type_id,
  );
  const [placements, setPlacements] = useState<Placement[]>(
    initial.placements.length
      ? initial.placements
      : [{ program_id: programs[0]?.program_id ?? 0, year_level: "1st Year" }],
  );

  const updatePlacement = (i: number, patch: Partial<Placement>) =>
    setPlacements((ps) =>
      ps.map((p, idx) => (idx === i ? { ...p, ...patch } : p)),
    );
  const addPlacement = () =>
    setPlacements((ps) => [
      ...ps,
      { program_id: programs[0]?.program_id ?? 0, year_level: "1st Year" },
    ]);
  const removePlacement = (i: number) =>
    setPlacements((ps) => ps.filter((_, idx) => idx !== i));

  const handleSave = () => {
    if (!courseTypeId) return;
    onSave({
      course_code: courseCode,
      course_description: description,
      course_type_id: courseTypeId,
      placements,
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Input
          placeholder="Course Code (e.g. CS101)"
          value={courseCode}
          onChange={(e) => setCourseCode(e.target.value)}
        />
        <Input
          placeholder="Course Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <Select
        value={courseTypeId ? String(courseTypeId) : ""}
        onValueChange={(v) => setCourseTypeId(Number(v))}
      >
        <SelectTrigger>
          <SelectValue placeholder="Course Type" />
        </SelectTrigger>
        <SelectContent>
          {courseTypes.map((ct) => (
            <SelectItem
              key={ct.course_type_id}
              value={String(ct.course_type_id)}
            >
              {ct.course_type_description} ({ct.total_hours} hrs)
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium">
            Curriculum Placements ({placements.length})
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={addPlacement}
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> Add Program
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mb-2">
          Add one row per program + year level this course belongs to.
        </p>
        <div className="space-y-2">
          {placements.map((pl, i) => (
            <div
              key={i}
              className="grid grid-cols-[1fr_140px_auto] gap-2 items-center"
            >
              <Select
                value={String(pl.program_id)}
                onValueChange={(v) =>
                  updatePlacement(i, { program_id: Number(v) })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Program" />
                </SelectTrigger>
                <SelectContent>
                  {programs.map((p) => (
                    <SelectItem key={p.program_id} value={String(p.program_id)}>
                      {p.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={pl.year_level}
                onValueChange={(v) => updatePlacement(i, { year_level: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {YEAR_LEVELS.map((y) => (
                    <SelectItem key={y} value={y}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removePlacement(i)}
                disabled={placements.length === 1}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave}>
          <Check className="w-4 h-4 mr-1" /> Save
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          <X className="w-4 h-4 mr-1" /> Cancel
        </Button>
      </div>
    </div>
  );
}

export function CoursesView() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseTypes, setCourseTypes] = useState<CourseType[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [curriculums, setCurriculums] = useState<Curriculum[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterProgram, setFilterProgram] = useState<string>("all");

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [coursesRes, typesRes, programsRes, curriculumRes] =
        await Promise.all([
          fetch("/api/courses"),
          fetch("/api/course-types"),
          fetch("/api/programs"),
          fetch("/api/curriculum"),
        ]);
      setCourses(await coursesRes.json());
      setCourseTypes(await typesRes.json());
      setPrograms(await programsRes.json());
      setCurriculums(await curriculumRes.json());
    } catch (err) {
      console.error("Failed to fetch courses data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  // Replaces all curriculum entries for a course with a new set —
  // same "delete then insert" pattern used for professor availability.
  const saveCurriculumForCourse = async (
    courseCode: string,
    placements: Placement[],
  ) => {
    const existing = curriculums.filter((c) => c.course_code === courseCode);
    await Promise.all(
      existing.map((c) =>
        fetch(`/api/curriculum/${c.curriculum_id}`, { method: "DELETE" }),
      ),
    );
    await Promise.all(
      placements.map((p) =>
        fetch("/api/curriculum", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            year_level: p.year_level,
            program_id: p.program_id,
            course_code: courseCode,
          }),
        }),
      ),
    );
  };

  const handleAdd = async (v: CourseFormValues) => {
    if (!v.course_code || !v.course_description || !v.course_type_id) return;
    try {
      await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course_code: v.course_code,
          course_description: v.course_description,
          course_type_id: v.course_type_id,
        }),
      });
      await saveCurriculumForCourse(v.course_code, v.placements);
      setShowForm(false);
      fetchAll();
    } catch (err) {
      console.error("Failed to create course", err);
    }
  };

  const handleEdit = async (v: CourseFormValues) => {
    if (!editingId || !v.course_description || !v.course_type_id) return;
    try {
      await fetch(`/api/courses/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course_description: v.course_description,
          course_type_id: v.course_type_id,
        }),
      });
      await saveCurriculumForCourse(editingId, v.placements);
      setEditingId(null);
      fetchAll();
    } catch (err) {
      console.error("Failed to update course", err);
    }
  };

  const removeCourse = async (code: string) => {
    try {
      await fetch(`/api/courses/${code}`, { method: "DELETE" });
      fetchAll();
    } catch (err) {
      console.error("Failed to delete course", err);
    }
  };

  const placementsOfCourse = (code: string) =>
    curriculums.filter((c) => c.course_code === code);

  const filtered = useMemo(() => {
    const matchingCuls = curriculums.filter(
      (cu) =>
        filterProgram === "all" || cu.program_id === Number(filterProgram),
    );
    const matchedCodes = new Set(matchingCuls.map((cu) => cu.course_code));

    return courses
      .filter((c) => matchedCodes.has(c.course_code))
      .filter((c) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
          c.course_code.toLowerCase().includes(q) ||
          c.course_description.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.course_code.localeCompare(b.course_code));
  }, [courses, curriculums, filterProgram, search]);

  const grouped = useMemo(() => {
    const map = new Map<number, Course[]>();
    filtered.forEach((c) => {
      const cPlacements = placementsOfCourse(c.course_code);
      const progIds =
        filterProgram === "all"
          ? Array.from(new Set(cPlacements.map((cu) => cu.program_id)))
          : [Number(filterProgram)];
      progIds.forEach((pid) => {
        const arr = map.get(pid) ?? [];
        arr.push(c);
        map.set(pid, arr);
      });
    });
    return Array.from(map.entries()).sort((a, b) => {
      const pa = programs.find((p) => p.program_id === a[0])?.description ?? "";
      const pb = programs.find((p) => p.program_id === b[0])?.description ?? "";
      return pa.localeCompare(pb);
    });
  }, [filtered, programs, filterProgram, curriculums]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold">Courses</h2>
          <p className="text-muted-foreground mt-1">
            Catalog of courses with curriculum placements per program.
          </p>
        </div>
        <Button
          onClick={() => {
            setShowForm(!showForm);
            setEditingId(null);
          }}
        >
          <Plus className="w-4 h-4 mr-1" /> Add Course
        </Button>
      </div>

      <div className="glass-card rounded-xl p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search code or description…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterProgram} onValueChange={setFilterProgram}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Programs</SelectItem>
            {programs.map((p) => (
              <SelectItem key={p.program_id} value={String(p.program_id)}>
                {p.description}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="glass-card rounded-xl p-5"
          >
            <CourseForm
              initial={{
                course_code: "",
                course_description: "",
                course_type_id: "",
                placements: [],
              }}
              programs={programs}
              courseTypes={courseTypes}
              onSave={handleAdd}
              onCancel={() => setShowForm(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {loading && (
        <div className="glass-card rounded-xl p-10 text-center text-sm text-muted-foreground">
          Loading courses...
        </div>
      )}

      {!loading && filtered.length === 0 ? (
        <div className="glass-card rounded-xl p-10 text-center text-sm text-muted-foreground">
          <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
          No courses match the current filters.
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([progId, list]) => {
            const program = programs.find((p) => p.program_id === progId);
            return (
              <div key={progId}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-muted-foreground">
                    {program?.description}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    • {list.length} course{list.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="space-y-2">
                  {list.map((c) => {
                    if (editingId === c.course_code) {
                      const initialPlacements = placementsOfCourse(
                        c.course_code,
                      ).map((cu) => ({
                        program_id: cu.program_id,
                        year_level: cu.year_level,
                      }));
                      return (
                        <motion.div
                          key={`${progId}-${c.course_code}-edit`}
                          layout
                          className="glass-card rounded-xl p-4 ring-2 ring-primary/30"
                        >
                          <CourseForm
                            initial={{
                              course_code: c.course_code,
                              course_description: c.course_description,
                              course_type_id: c.course_type_id,
                              placements: initialPlacements,
                            }}
                            programs={programs}
                            courseTypes={courseTypes}
                            onSave={handleEdit}
                            onCancel={() => setEditingId(null)}
                          />
                        </motion.div>
                      );
                    }
                    const ct = courseTypes.find(
                      (t) => t.course_type_id === c.course_type_id,
                    );
                    const placementsHere = placementsOfCourse(
                      c.course_code,
                    ).filter((cu) => cu.program_id === progId);
                    return (
                      <motion.div
                        key={`${progId}-${c.course_code}`}
                        layout
                        className="glass-card rounded-xl p-4 flex items-start justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-sm font-semibold text-primary">
                              {c.course_code}
                            </span>
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full ${ct?.course_type_description === "Laboratory" ? "bg-primary/10 text-primary" : "bg-info-light text-info"}`}
                            >
                              {ct?.course_type_description || "Unknown"}
                            </span>
                            {placementsHere.map((cu, i) => (
                              <span
                                key={i}
                                className="text-xs px-2 py-0.5 rounded-full bg-secondary"
                              >
                                {cu.year_level}
                              </span>
                            ))}
                          </div>
                          <p className="font-medium mt-1">
                            {c.course_description}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditingId(c.course_code);
                              setShowForm(false);
                            }}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeCourse(c.course_code)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
