import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Plus,
  Trash2,
  Users,
  Pencil,
  Check,
  X,
  BookOpen,
  ChevronDown,
  Search,
} from "lucide-react";
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
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";

interface Section {
  section_id: number;
  number_of_students: number;
  year_level: string;
  program_id: number;
  section_name: string | null;
}

interface Program {
  program_id: number;
  description: string;
}

interface Course {
  course_code: string;
  course_description: string;
}

interface Curriculum {
  curriculum_id: number;
  year_level: string;
  program_id: number;
  course_code: string;
}

interface Schedule {
  schedule_id: number;
  term: string;
  year: string;
  status: string;
}

const YEAR_LEVELS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];
const MAX_STUDENTS = 100;

interface SectionFormValues {
  section_name: string;
  program_id: number | "";
  year_level: string;
  number_of_students: number;
}

interface SectionFormProps {
  initial: SectionFormValues;
  programs: Program[];
  courses: Course[];
  curriculums: Curriculum[];
  onSave: (v: SectionFormValues) => void;
  onCancel: () => void;
}

function SectionForm({
  initial,
  programs,
  courses,
  curriculums,
  onSave,
  onCancel,
}: SectionFormProps) {
  const [sectionName, setSectionName] = useState(initial.section_name);
  const [programId, setProgramId] = useState<number | "">(initial.program_id);
  const [yearLevel, setYearLevel] = useState(initial.year_level);

  const [studentCount, setStudentCount] = useState(
    String(initial.number_of_students),
  );
  const [error, setError] = useState("");

  const previewCourses = useMemo(() => {
    if (!programId) return [];
    const codes = curriculums
      .filter((c) => c.program_id === programId && c.year_level === yearLevel)
      .map((c) => c.course_code);
    return courses.filter((c) => codes.includes(c.course_code));
  }, [programId, yearLevel, curriculums, courses]);

  const handleSave = () => {
    if (!programId) {
      setError("Program is required.");
      return;
    }
    const trimmedName = sectionName.trim().toUpperCase();
    if (!trimmedName) {
      setError("Section letter is required.");
      return;
    }
    if (trimmedName.length > 20) {
      setError("Section letter must be 20 characters or less.");
      return;
    }
    const countNum = Number(studentCount);
    if (
      !studentCount.trim() ||
      !Number.isInteger(countNum) ||
      countNum <= 0 ||
      countNum > MAX_STUDENTS
    ) {
      setError(
        `Number of students must be an integer between 1 and ${MAX_STUDENTS}.`,
      );
      return;
    }
    setError("");
    onSave({
      section_name: trimmedName,
      program_id: programId,
      year_level: yearLevel,
      number_of_students: countNum,
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
        <Select
          value={programId ? String(programId) : ""}
          onValueChange={(v) => setProgramId(Number(v))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select Program" />
          </SelectTrigger>
          <SelectContent>
            {programs.map((p) => (
              <SelectItem key={p.program_id} value={String(p.program_id)}>
                {p.description}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={yearLevel} onValueChange={setYearLevel}>
          <SelectTrigger>
            <SelectValue placeholder="Year Level" />
          </SelectTrigger>
          <SelectContent>
            {YEAR_LEVELS.map((y) => (
              <SelectItem key={y} value={y}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          placeholder="Section Letter (e.g. A)"
          value={sectionName}
          onChange={(e) => setSectionName(e.target.value)}
          maxLength={20}
        />
        <Input
          type="number"
          placeholder="Number of Students"
          value={studentCount}
          onChange={(e) => setStudentCount(e.target.value)}
          min="1"
          max={MAX_STUDENTS}
        />
      </div>

      {programId && (
        <div className="bg-muted/40 rounded-lg p-3 text-xs">
          <div className="flex items-center gap-1.5 font-medium mb-1.5">
            <BookOpen className="w-3.5 h-3.5" />
            Courses for this program/year ({previewCourses.length})
          </div>
          {previewCourses.length === 0 ? (
            <p className="text-muted-foreground">
              No courses defined for this program/year yet.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1">
              {previewCourses.map((c) => (
                <span
                  key={c.course_code}
                  className="font-mono bg-background px-1.5 py-0.5 rounded"
                >
                  {c.course_code}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" size="sm">
          <Check className="w-4 h-4 mr-1" /> Save
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          <X className="w-4 h-4 mr-1" /> Cancel
        </Button>
      </div>
    </form>
  );
}

export function SectionsView() {
  const [sections, setSections] = useState<Section[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [curriculums, setCurriculums] = useState<Curriculum[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [activeSemester, setActiveSemester] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSemForm, setShowSemForm] = useState(false);
  const [semYear, setSemYear] = useState("");
  const [semTerm, setSemTerm] = useState("1st Semester");
  const [semStart, setSemStart] = useState("");
  const [semEnd, setSemEnd] = useState("");
  const [semError, setSemError] = useState("");
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Section | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [
        sectionsRes,
        programsRes,
        coursesRes,
        curriculumRes,
        schedulesRes,
      ] = await Promise.all([
        fetch("/api/sections"),
        fetch("/api/programs"),
        fetch("/api/courses"),
        fetch("/api/curriculum"),
        fetch("/api/schedules"),
      ]);
      setSections(await sectionsRes.json());
      setPrograms(await programsRes.json());
      setCourses(await coursesRes.json());
      setCurriculums(await curriculumRes.json());

      const schedulesData = await schedulesRes.json();
      setSchedules(schedulesData);

      const active = schedulesData.find((s: Schedule) => s.status === "active");
      setActiveSemester(active ? `${active.term} ${active.year}` : "");
    } catch (err) {
      console.error("Failed to fetch sections data", err);
      setError("Failed to load sections data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const handleAdd = async (v: SectionFormValues) => {
    if (!v.program_id || !v.year_level) return;
    try {
      const res = await fetch("/api/sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section_name: v.section_name,
          program_id: v.program_id,
          year_level: v.year_level,
          number_of_students: v.number_of_students,
        }),
      });
      if (!res.ok) {
        setError(`Failed to create section: ${res.statusText}`);
        return;
      }
      setShowForm(false);
      fetchAll();
    } catch (err) {
      console.error("Failed to create section", err);
      setError("Error creating section");
    }
  };

  const handleEdit = async (v: SectionFormValues) => {
    if (!editingId || !v.program_id || !v.year_level) return;
    try {
      const res = await fetch(`/api/sections/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section_name: v.section_name,
          program_id: v.program_id,
          year_level: v.year_level,
          number_of_students: v.number_of_students,
        }),
      });
      if (!res.ok) {
        setError(`Failed to update section: ${res.statusText}`);
        return;
      }
      setEditingId(null);
      fetchAll();
    } catch (err) {
      console.error("Failed to update section", err);
      setError("Error updating section");
    }
  };

  const removeSection = async (id: number) => {
    try {
      const res = await fetch(`/api/sections/${id}`, { method: "DELETE" });
      if (!res.ok) {
        setError(`Failed to delete section: ${res.statusText}`);
        return;
      }
      fetchAll();
    } catch (err) {
      console.error("Failed to delete section", err);
      setError("Error deleting section");
    }
  };

  const handleActivateSemester = async (schedule: Schedule) => {
    try {
      const res = await fetch(
        `/api/schedules/${schedule.schedule_id}/activate`,
        { method: "PUT" },
      );
      if (!res.ok) {
        setError(`Failed to activate semester: ${res.statusText}`);
        return;
      }
      setDropdownOpen(false);
      fetchAll();
    } catch (err) {
      console.error("Failed to activate semester", err);
      setError("Error activating semester");
    }
  };

  const createSemester = async () => {
    if (!/^\d{4}$/.test(semYear))
      return setSemError("Enter a 4-digit year, e.g. 2025.");
    if (!semStart || !semEnd)
      return setSemError("Start and end dates are required.");
    if (semEnd <= semStart)
      return setSemError("End date must be after the start date.");
    setSemError("");
    try {
      const res = await fetch("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          academic_year: semYear,
          school_term: semTerm,
          start_date: semStart,
          end_date: semEnd,
        }),
      });
      if (!res.ok)
        return setSemError("Failed to create semester. It may already exist.");
      setShowSemForm(false);
      setSemYear("");
      setSemStart("");
      setSemEnd("");
      fetchAll();
    } catch {
      setSemError("Error creating semester");
    }
  };

  const programCode = useCallback(
    (id: number) => {
      const p = programs.find((pr) => pr.program_id === id);
      return p ? p.description : "";
    },
    [programs],
  );

  const sectionDisplayName = useCallback(
    (s: Section) => {
      const label = programCode(s.program_id);
      return `${label} ${s.year_level}${s.section_name ? " " + s.section_name : ""}`;
    },
    [programCode],
  );

  const courseCountFor = useCallback(
    (s: Section) =>
      curriculums.filter(
        (c) => c.program_id === s.program_id && c.year_level === s.year_level,
      ).length,
    [curriculums],
  );

  const filtered = useMemo(() => {
    if (!search) return sections;
    const q = search.toLowerCase();
    return sections.filter((s) => {
      const label = sectionDisplayName(s).toLowerCase();
      return label.includes(q);
    });
  }, [sections, search, sectionDisplayName]);

  const sorted = useMemo(
    () =>
      [...filtered].sort((a, b) => {
        const pa = programCode(a.program_id);
        const pb = programCode(b.program_id);
        return (
          pa.localeCompare(pb) ||
          a.year_level.localeCompare(b.year_level) ||
          (a.section_name ?? "").localeCompare(b.section_name ?? "")
        );
      }),
    [filtered, programCode],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-heading text-2xl font-bold">Sections</h2>
          <p className="text-muted-foreground mt-1">
            Student groups by program & year level
          </p>
        </div>
        <div className="flex items-center gap-3">
          {schedules.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-2 px-4 py-2 bg-yellow-400 text-black rounded-md font-medium text-sm hover:bg-yellow-500 transition-colors"
              >
                {activeSemester || "Select Semester"}{" "}
                <ChevronDown className="w-4 h-4" />
              </button>
              {dropdownOpen && (
                <div className="absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-10 min-w-max">
                  {schedules.map((s) => {
                    const label = `${s.term} ${s.year}`;
                    return (
                      <button
                        key={s.schedule_id}
                        onClick={() => handleActivateSemester(s)}
                        className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                          activeSemester === label
                            ? "bg-yellow-400 text-black font-semibold"
                            : "text-gray-700 hover:bg-gray-100"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          <Button
            variant="outline"
            onClick={() => setShowSemForm(!showSemForm)}
          >
            <Plus className="w-4 h-4 mr-1" /> New Semester
          </Button>
          <Button
            onClick={() => {
              setShowForm(!showForm);
              setEditingId(null);
            }}
          >
            <Plus className="w-4 h-4 mr-1" /> Add Section
          </Button>
        </div>
      </div>
      <div className="glass-card rounded-xl p-4">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by program, year level, or section…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {error && (
        <div className="glass-card rounded-xl p-4 text-sm text-destructive bg-destructive/10 border border-destructive/20">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 text-xs underline"
          >
            Dismiss
          </button>
        </div>
      )}

      <AnimatePresence>
        {showSemForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="glass-card rounded-xl p-5 space-y-3"
          >
            <div className="grid grid-cols-2 gap-4">
              <Input
                placeholder="Academic year (e.g. 2025)"
                value={semYear}
                maxLength={4}
                onChange={(e) => setSemYear(e.target.value)}
              />
              <select
                value={semTerm}
                onChange={(e) => setSemTerm(e.target.value)}
                className="border rounded-md px-3 text-sm bg-background"
              >
                <option>1st Semester</option>
                <option>2nd Semester</option>
              </select>
              <Input
                type="date"
                value={semStart}
                onChange={(e) => setSemStart(e.target.value)}
              />
              <Input
                type="date"
                value={semEnd}
                onChange={(e) => setSemEnd(e.target.value)}
              />
            </div>
            {semError && <p className="text-xs text-destructive">{semError}</p>}
            <div className="flex gap-2">
              <Button size="sm" onClick={createSemester}>
                <Check className="w-4 h-4 mr-1" /> Create
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowSemForm(false)}
              >
                <X className="w-4 h-4 mr-1" /> Cancel
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="glass-card rounded-xl p-5"
          >
            <SectionForm
              initial={{
                section_name: "",
                program_id: "",
                year_level: "1st Year",
                number_of_students: 0,
              }}
              programs={programs}
              courses={courses}
              curriculums={curriculums}
              onSave={handleAdd}
              onCancel={() => setShowForm(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {loading && (
        <div className="glass-card rounded-xl p-10 text-center text-sm text-muted-foreground">
          Loading sections...
        </div>
      )}
      {!loading && filtered.length === 0 && sections.length > 0 && (
        <div className="glass-card rounded-xl p-10 text-center text-sm text-muted-foreground">
          No sections match your search.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <AnimatePresence mode="popLayout">
          {sorted.map((s, index) => {
            if (editingId === s.section_id) {
              return (
                <motion.div
                  key={s.section_id}
                  layout
                  className="glass-card rounded-xl p-4 ring-2 ring-primary/30 md:col-span-2"
                >
                  <SectionForm
                    initial={{
                      section_name: s.section_name ?? "",
                      program_id: s.program_id,
                      year_level: s.year_level,
                      number_of_students: s.number_of_students,
                    }}
                    programs={programs}
                    courses={courses}
                    curriculums={curriculums}
                    onSave={handleEdit}
                    onCancel={() => setEditingId(null)}
                  />
                </motion.div>
              );
            }
            const courseCount = courseCountFor(s);
            const stagger = Math.min(index, 8) * 0.05;
            return (
              <motion.div
                key={s.section_id}
                layout
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{
                  opacity: { duration: 0.3, delay: stagger },
                  y: { duration: 0.3, delay: stagger },
                }}
                className="glass-card rounded-xl p-4 flex items-start justify-between"
              >
                <div className="min-w-0">
                  <p className="font-medium">{sectionDisplayName(s)}</p>
                  <p
                    className={`text-xs mt-0.5 ${
                      courseCount === 0
                        ? "text-destructive"
                        : "text-muted-foreground"
                    }`}
                  >
                    {courseCount === 0
                      ? "No courses for this year yet"
                      : `${courseCount} course${courseCount !== 1 ? "s" : ""}`}
                  </p>
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground mt-1">
                    <Users className="w-3 h-3" /> {s.number_of_students}{" "}
                    students
                  </span>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setEditingId(s.section_id);
                      setShowForm(false);
                    }}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteTarget(s)}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        <ConfirmDeleteDialog
          open={deleteTarget !== null}
          title="Delete this Section?"
          description={` Are you sure you want to delete ${deleteTarget?.section_name}?`}
          onConfirm={() => {
            if (deleteTarget) removeSection(deleteTarget.section_id);
            setDeleteTarget(null);
          }}
          onCancel={() => setDeleteTarget(null)}
        />
      </div>
    </div>
  );
}
