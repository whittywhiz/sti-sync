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
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { ImportExcelButton } from "@/components/ImportExcelButton";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";

interface Course {
  course_code: string;
  course_description: string;
  course_type_id: number;
}

interface CourseType {
  course_type_id: number;
  course_type_description: string;
  total_hours: number;
}

interface Program {
  program_id: number;
  description: string;
}

interface Curriculum {
  curriculum_id: number;
  year_level: string;
  program_id: number;
  course_code: string;
  term?: string;
  subject_type?: "Major" | "Minor";
}

interface Employee {
  employee_id: number;
  name: string;
  department: string;
}

interface Placement {
  program_id: number;
  year_level: string;
  term?: string;
  subject_type?: "Major" | "Minor";
}

interface CourseFormValues {
  course_code: string;
  course_description: string;
  course_type_id: number | "";
  placements: Placement[];
  employee_ids: number[];
}

interface CourseFormProps {
  initial: CourseFormValues;
  programs: Program[];
  courseTypes: CourseType[];
  employees: Employee[];
  onSave: (v: CourseFormValues) => void;
  onCancel: () => void;
}

const YEAR_LEVELS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];
const TERMS = ["1st Semester", "2nd Semester"];
const UNPLACED = 0; // pseudo program id for the "Unplaced courses" group

function CourseForm({
  initial,
  programs,
  courseTypes,
  employees,
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
      ? initial.placements.map((p) => ({
          ...p,
          term: p.term ?? "1st Semester",
        }))
      : [
          {
            program_id: programs[0]?.program_id ?? 0,
            year_level: "1st Year",
            term: "1st Semester",
          },
        ],
  );
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<number[]>(
    initial.employee_ids,
  );
  const [error, setError] = useState("");

  const updatePlacement = (i: number, patch: Partial<Placement>) =>
    setPlacements((ps) =>
      ps.map((p, idx) => (idx === i ? { ...p, ...patch } : p)),
    );
  const addPlacement = () =>
    setPlacements((ps) => [
      ...ps,
      {
        program_id: programs[0]?.program_id ?? 0,
        year_level: "1st Year",
        term: "1st Semester",
      },
    ]);
  const removePlacement = (i: number) =>
    setPlacements((ps) => ps.filter((_, idx) => idx !== i));

  const toggleEmployee = (id: number) =>
    setSelectedEmployeeIds((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    );

  const handleSave = () => {
    if (!courseCode.trim()) {
      setError("Course code is required.");
      return;
    }
    if (!description.trim()) {
      setError("Course description is required.");
      return;
    }
    if (!courseTypeId) {
      setError("Course type is required.");
      return;
    }
    const keys = placements.map(
      (p) => `${p.program_id}|${p.year_level}|${p.term}`,
    );
    if (new Set(keys).size !== keys.length) {
      setError(
        "Two placements have the same program, year level and term. Remove one.",
      );
      return;
    }
    setError("");
    onSave({
      course_code: courseCode,
      course_description: description,
      course_type_id: courseTypeId,
      placements,
      employee_ids: selectedEmployeeIds,
    });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSave();
      }}
      className="space-y-4"
    >
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
          Add one row per program + year level + semester this course belongs
          to.
        </p>
        <div className="space-y-2">
          {placements.map((pl, i) => (
            <div
              key={i}
              className="grid grid-cols-[1fr_130px_150px_auto] gap-2 items-center"
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
              <Select
                value={pl.term ?? "1st Semester"}
                onValueChange={(v) => updatePlacement(i, { term: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TERMS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
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

      <div>
        <p className="text-sm font-medium mb-2">
          Assigned Professors ({selectedEmployeeIds.length})
        </p>
        <p className="text-xs text-muted-foreground mb-2">
          Click to select any number of professors eligible to teach this
          course.
        </p>
        <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto border rounded-md p-2">
          {employees.length === 0 && (
            <p className="text-xs text-muted-foreground">
              No professors found.
            </p>
          )}
          {employees.map((e) => {
            const selected = selectedEmployeeIds.includes(e.employee_id);
            return (
              <button
                type="button"
                key={e.employee_id}
                onClick={() => toggleEmployee(e.employee_id)}
                className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                  selected
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background border-input hover:bg-secondary"
                }`}
              >
                {e.name}
                <span className="opacity-70"> · {e.department}</span>
              </button>
            );
          })}
        </div>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" size="sm">
          <Check className="w-4 h-4 mr-1" /> Save
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>
          <X className="w-4 h-4 mr-1" /> Cancel
        </Button>
      </div>
    </form>
  );
}

export function CoursesView() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseTypes, setCourseTypes] = useState<CourseType[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [curriculums, setCurriculums] = useState<Curriculum[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingEmployeeIds, setEditingEmployeeIds] = useState<number[]>([]);
  const [search, setSearch] = useState("");
  const [filterProgram, setFilterProgram] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [editingProgId, setEditingProgId] = useState<number | null>(null);
  const [assignedCodes, setAssignedCodes] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const responses = await Promise.all([
        fetch("/api/courses"),
        fetch("/api/course-types"),
        fetch("/api/programs"),
        fetch("/api/curriculum"),
        fetch("/api/employees"),
        fetch("/api/course-employees"),
      ]);
      const [c, t, p, cu, e, a] = await Promise.all(
        responses.map((r) => r.json()),
      );
      setCourses(c);
      setCourseTypes(t);
      setPrograms(p);
      setCurriculums(cu);
      setEmployees(e);
      setAssignedCodes(
        new Set(Array.isArray(a) ? a.map((r: any) => r.course_code) : []),
      );
    } catch (err) {
      console.error("Failed to fetch courses data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const saveCurriculumForCourse = async (
    courseCode: string,
    placements: Placement[],
  ) => {
    const existing = curriculums.filter((c) => c.course_code === courseCode);

    const post = (p: {
      year_level: string;
      program_id: number;
      term?: string;
      subject_type?: "Major" | "Minor" | null;
    }) =>
      fetch("/api/curriculum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year_level: p.year_level,
          program_id: p.program_id,
          course_code: courseCode,
          term: p.term ?? "1st Semester",
          subject_type: p.subject_type ?? null,
        }),
      });

    await Promise.all(
      existing.map((c) =>
        fetch(`/api/curriculum/${c.curriculum_id}`, { method: "DELETE" }),
      ),
    );

    const results = await Promise.all(placements.map(post));
    const bad = results.find((r) => !r.ok);
    if (bad) {
      const data = await bad.json().catch(() => ({}));
      await Promise.all(existing.map(post)); // put the old rows back
      throw new Error(data.error ?? "Could not save curriculum placements");
    }
  };

  const saveCourseEmployees = async (
    courseCode: string,
    employeeIds: number[],
  ) => {
    await fetch(`/api/courses/${courseCode}/employees`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employee_ids: employeeIds }),
    });
  };

  const changeSubjectType = async (curriculumId: number, value: string) => {
    const res = await fetch(`/api/curriculum/${curriculumId}/subject-type`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject_type: value }),
    });
    if (res.ok) fetchAll();
    else toast.error("Failed to update subject type");
  };

  const handleAdd = async (v: CourseFormValues) => {
    const code = v.course_code.trim();
    if (!code || !v.course_description || !v.course_type_id) return;
    try {
      const res = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course_code: code,
          course_description: v.course_description,
          course_type_id: v.course_type_id,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Could not add the course.");
        return;
      }
      await saveCourseEmployees(code, v.employee_ids);
      await saveCurriculumForCourse(code, v.placements);
      setShowForm(false);
      fetchAll();
    } catch (err) {
      console.error("Failed to create course", err);
      toast.error(err instanceof Error ? err.message : "Could not save.");
    }
  };

  const handleEdit = async (v: CourseFormValues) => {
    if (!editingId || !v.course_description || !v.course_type_id) return;
    try {
      const res = await fetch(`/api/courses/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          course_description: v.course_description,
          course_type_id: v.course_type_id,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Could not update the course.");
        return;
      }
      await saveCurriculumForCourse(editingId, v.placements);
      await saveCourseEmployees(editingId, v.employee_ids);
      setEditingId(null);
      fetchAll();
    } catch (err) {
      console.error("Failed to update course", err);
      toast.error(
        err instanceof Error
          ? `${err.message}. Placements were restored.`
          : "Could not save the course placements.",
      );
    }
  };
  const startEdit = async (code: string, progId: number) => {
    setEditingProgId(progId);
    setShowForm(false);
    try {
      const res = await fetch(`/api/courses/${code}/employees`);
      const data = await res.json();
      setEditingEmployeeIds(
        Array.isArray(data) ? data.map((e: any) => e.employee_id) : [],
      );
    } catch (err) {
      console.error("Failed to fetch assigned professors", err);
      setEditingEmployeeIds([]);
    }
    setEditingId(code);
  };

  const removeCourse = async (code: string) => {
    try {
      const res = await fetch(`/api/courses/${code}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Failed to delete course");
        return;
      }
      setSelected((s) => s.filter((x) => x !== code));
      fetchAll();
    } catch (err) {
      console.error("Failed to delete course", err);
      toast.error("Failed to delete course");
    }
  };

  const toggleSelect = (code: string) =>
    setSelected((s) =>
      s.includes(code) ? s.filter((x) => x !== code) : [...s, code],
    );

  const removeSelected = async () => {
    const codes = [...selected];
    const failed: string[] = [];
    let firstError = "";
    for (const code of codes) {
      try {
        const res = await fetch(`/api/courses/${code}`, { method: "DELETE" });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          failed.push(code);
          if (!firstError) firstError = data.error ?? "";
        }
      } catch {
        failed.push(code);
      }
    }
    const deleted = codes.length - failed.length;
    if (deleted > 0) {
      toast.success(`Deleted ${deleted} course${deleted !== 1 ? "s" : ""}`);
    }
    if (failed.length > 0) {
      toast.error(
        `Could not delete ${failed.join(", ")}${firstError ? `: ${firstError}` : ""}`,
      );
    }
    setSelected(failed);
    fetchAll();
  };

  const placementsOfCourse = (code: string) =>
    curriculums.filter((c) => c.course_code === code);

  const matchesType = (cu: Curriculum) =>
    filterType === "all" || (cu.subject_type ?? "Major") === filterType;

  const filtered = useMemo(() => {
    const matchingCuls = curriculums.filter(
      (cu) =>
        (filterProgram === "all" || cu.program_id === Number(filterProgram)) &&
        matchesType(cu),
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
  }, [courses, curriculums, filterProgram, filterType, search]);

  // Courses that exist but have no curriculum placement at all.
  const unplaced = useMemo(() => {
    if (filterProgram !== "all" || filterType !== "all") return [];
    const placed = new Set(curriculums.map((cu) => cu.course_code));
    const q = search.toLowerCase();
    return courses
      .filter((c) => !placed.has(c.course_code))
      .filter(
        (c) =>
          !q ||
          c.course_code.toLowerCase().includes(q) ||
          c.course_description.toLowerCase().includes(q),
      )
      .sort((a, b) => a.course_code.localeCompare(b.course_code));
  }, [courses, curriculums, filterProgram, filterType, search]);

  const grouped = useMemo(() => {
    const map = new Map<number, Course[]>();
    filtered.forEach((c) => {
      const cPlacements = placementsOfCourse(c.course_code).filter(matchesType);
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
  }, [filtered, programs, filterProgram, filterType, curriculums]);

  const renderEditForm = (c: Course, key: string) => {
    const initialPlacements = placementsOfCourse(c.course_code).map((cu) => ({
      program_id: cu.program_id,
      year_level: cu.year_level,
      term: cu.term,
      subject_type: cu.subject_type,
    }));
    return (
      <motion.div
        key={key}
        layout
        className="glass-card rounded-xl p-4 ring-2 ring-primary/30"
      >
        <CourseForm
          initial={{
            course_code: c.course_code,
            course_description: c.course_description,
            course_type_id: c.course_type_id,
            placements: initialPlacements,
            employee_ids: editingEmployeeIds,
          }}
          programs={programs}
          courseTypes={courseTypes}
          employees={employees}
          onSave={handleEdit}
          onCancel={() => setEditingId(null)}
        />
      </motion.div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="sticky top-0 z-50 bg-background pt-4 pb-4 -mx-6 px-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-heading text-2xl font-bold">Courses</h2>
            <p className="text-muted-foreground mt-1">
              Catalog of courses with curriculum placements per program.
            </p>
          </div>
          <div className="flex gap-2">
            <span
              className="inline-block [&_button]:!bg-white [&_button]:!text-gray-800 [&_button]:!border
  [&_button]:!border-gray-300 hover:[&_button]:!bg-gray-100 [&_button]:rounded-md"
            >
              <ImportExcelButton
                endpoint="/api/courses/import"
                onDone={fetchAll}
              />
            </span>

            <Button
              onClick={() => {
                setShowForm(!showForm);
                setEditingId(null);
              }}
            >
              <Plus className="w-4 h-4 mr-1" /> Add Course
            </Button>
          </div>
        </div>

        <div className="glass-card rounded-xl p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search code or description…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setEditingId(null);
              }}
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
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Subjects</SelectItem>
              <SelectItem value="Major">Major</SelectItem>
              <SelectItem value="Minor">Minor</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {selected.length > 0 && (
          <div className="glass-card rounded-xl mt-3 px-4 py-2 flex items-center justify-between text-sm">
            <span className="font-medium">{selected.length} selected</span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  setSelected([
                    ...filtered.map((c) => c.course_code),
                    ...unplaced.map((c) => c.course_code),
                  ])
                }
              >
                Select all ({filtered.length + unplaced.length})
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
                Clear
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setBulkDeleteOpen(true)}
              >
                <Trash2 className="w-4 h-4 mr-1" /> Delete selected
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* SCROLLABLE CONTENT */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="glass-card rounded-xl p-5"
          >
            <CourseForm
              initial={{
                course_code: "",
                course_description: "",
                course_type_id: "",
                placements: [],
                employee_ids: [],
              }}
              programs={programs}
              courseTypes={courseTypes}
              employees={employees}
              onSave={handleAdd}
              onCancel={() => setShowForm(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {!loading && filtered.length === 0 && unplaced.length === 0 ? (
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
                  <AnimatePresence mode="popLayout">
                    {list.map((c, index) => {
                      if (
                        editingId === c.course_code &&
                        editingProgId === progId
                      ) {
                        return renderEditForm(
                          c,
                          `${progId}-${c.course_code}-edit`,
                        );
                      }
                      const ct = courseTypes.find(
                        (t) => t.course_type_id === c.course_type_id,
                      );
                      const placementsHere = placementsOfCourse(
                        c.course_code,
                      ).filter(
                        (cu) => cu.program_id === progId && matchesType(cu),
                      );
                      const stagger = search ? 0 : Math.min(index, 8) * 0.05;
                      const isSelected = selected.includes(c.course_code);
                      return (
                        <motion.div
                          key={`${progId}-${c.course_code}`}
                          layout={!search}
                          initial={search ? false : { opacity: 0, y: 16 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{
                            opacity: { duration: 0.3, delay: stagger },
                            y: { duration: 0.3, delay: stagger },
                          }}
                          className={`glass-card rounded-xl p-4 flex items-start justify-between gap-3 ${
                            isSelected ? "ring-2 ring-primary/40" : ""
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(c.course_code)}
                            aria-label={`Select ${c.course_code}`}
                            className="self-center h-4 w-4 shrink-0 cursor-pointer accent-primary"
                          />
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
                              {!assignedCodes.has(c.course_code) && (
                                <span
                                  title="No professor assigned. Any available professor can be scheduled."
                                  className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200"
                                >
                                  No professor assigned
                                </span>
                              )}
                              {placementsHere.map((cu) => (
                                <span
                                  key={cu.curriculum_id}
                                  className="flex items-center gap-1"
                                >
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-secondary">
                                    {cu.year_level}
                                    {cu.term
                                      ? ` · ${cu.term.replace(" Semester", " Sem")}`
                                      : ""}
                                  </span>
                                  <select
                                    value={cu.subject_type ?? "Major"}
                                    onChange={(e) =>
                                      changeSubjectType(
                                        cu.curriculum_id,
                                        e.target.value,
                                      )
                                    }
                                    className="text-xs border rounded px-1 py-0.5 bg-background"
                                  >
                                    <option value="Major">Major</option>
                                    <option value="Minor">Minor</option>
                                  </select>
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
                              onClick={() => startEdit(c.course_code, progId)}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteTarget(c.course_code)}
                            >
                              <Trash2 className="w-4 h-4 text-destructive" />
                            </Button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </div>
            );
          })}

          {unplaced.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-semibold text-destructive">
                  Unplaced courses
                </span>
                <span className="text-xs text-muted-foreground">
                  • {unplaced.length} course{unplaced.length !== 1 ? "s" : ""}{" "}
                  not in any program yet. Edit one to place it.
                </span>
              </div>
              <div className="space-y-2">
                {unplaced.map((c) => {
                  if (
                    editingId === c.course_code &&
                    editingProgId === UNPLACED
                  ) {
                    return renderEditForm(c, `unplaced-${c.course_code}-edit`);
                  }
                  const ct = courseTypes.find(
                    (t) => t.course_type_id === c.course_type_id,
                  );
                  const isSelected = selected.includes(c.course_code);
                  return (
                    <div
                      key={`unplaced-${c.course_code}`}
                      className={`glass-card rounded-xl p-4 flex items-start justify-between gap-3 border border-destructive/30 ${
                        isSelected ? "ring-2 ring-primary/40" : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(c.course_code)}
                        aria-label={`Select ${c.course_code}`}
                        className="self-center h-4 w-4 shrink-0 cursor-pointer accent-primary"
                      />
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
                          <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-200">
                            No program placement
                          </span>
                          {!assignedCodes.has(c.course_code) && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                              No professor assigned
                            </span>
                          )}
                        </div>
                        <p className="font-medium mt-1">
                          {c.course_description}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => startEdit(c.course_code, UNPLACED)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteTarget(c.course_code)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        title="Delete this course?"
        description={`Are you sure you want to delete ${deleteTarget}?`}
        onConfirm={() => {
          if (deleteTarget) removeCourse(deleteTarget);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDeleteDialog
        open={bulkDeleteOpen}
        title={`Delete ${selected.length} selected course${selected.length !== 1 ? "s" : ""}?`}
        description="This also removes their curriculum placements. Courses used by scheduled classes can't be deleted and will stay selected."
        onConfirm={() => {
          setBulkDeleteOpen(false);
          removeSelected();
        }}
        onCancel={() => setBulkDeleteOpen(false)}
      />
    </div>
  );
}
