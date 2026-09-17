import { useState, useMemo, useEffect } from "react";
import { Plus, Trash2, Users, Pencil, Check, X, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

const YEAR_LEVELS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

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
    if (!sectionName.trim()) {
      setError("Section letter is required.");
      return;
    }
    const countNum = Number(studentCount);
    if (!studentCount.trim() || countNum <= 0) {
      setError("Number of students must be greater than 0.");
      return;
    }
    setError("");
    onSave({
      section_name: sectionName,
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
        />
        <Input
          type="number"
          placeholder="Number of Students"
          value={studentCount}
          onChange={(e) => setStudentCount(e.target.value)}
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
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [sectionsRes, programsRes, coursesRes, curriculumRes] =
        await Promise.all([
          fetch("/api/sections"),
          fetch("/api/programs"),
          fetch("/api/courses"),
          fetch("/api/curriculum"),
        ]);
      setSections(await sectionsRes.json());
      setPrograms(await programsRes.json());
      setCourses(await coursesRes.json());
      setCurriculums(await curriculumRes.json());
    } catch (err) {
      console.error("Failed to fetch sections data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const handleAdd = async (v: SectionFormValues) => {
    if (!v.program_id || !v.year_level) return;
    try {
      await fetch("/api/sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section_name: v.section_name,
          program_id: v.program_id,
          year_level: v.year_level,
          number_of_students: v.number_of_students,
        }),
      });
      setShowForm(false);
      fetchAll();
    } catch (err) {
      console.error("Failed to create section", err);
    }
  };

  const handleEdit = async (v: SectionFormValues) => {
    if (!editingId || !v.program_id || !v.year_level) return;
    try {
      await fetch(`/api/sections/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section_name: v.section_name,
          program_id: v.program_id,
          year_level: v.year_level,
          number_of_students: v.number_of_students,
        }),
      });
      setEditingId(null);
      fetchAll();
    } catch (err) {
      console.error("Failed to update section", err);
    }
  };

  const removeSection = async (id: number) => {
    try {
      await fetch(`/api/sections/${id}`, { method: "DELETE" });
      fetchAll();
    } catch (err) {
      console.error("Failed to delete section", err);
    }
  };

  const programCode = (id: number) => {
    const p = programs.find((pr) => pr.program_id === id);
    return p ? p.description : "";
  };

  const sectionDisplayName = (s: Section) => {
    const prog = programs.find((p) => p.program_id === s.program_id);
    const label = prog?.description ?? "";
    return `${label} ${s.year_level}${s.section_name ? " " + s.section_name : ""}`;
  };

  const courseCountFor = (s: Section) =>
    curriculums.filter(
      (c) => c.program_id === s.program_id && c.year_level === s.year_level,
    ).length;

  const sorted = useMemo(
    () =>
      [...sections].sort((a, b) => {
        const pa = programCode(a.program_id);
        const pb = programCode(b.program_id);
        return (
          pa.localeCompare(pb) ||
          a.year_level.localeCompare(b.year_level) ||
          (a.section_name ?? "").localeCompare(b.section_name ?? "")
        );
      }),
    [sections, programs],
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
        <Button
          onClick={() => {
            setShowForm(!showForm);
            setEditingId(null);
          }}
        >
          <Plus className="w-4 h-4 mr-1" /> Add Section
        </Button>
      </div>

      {showForm && (
        <div className="glass-card rounded-xl p-5">
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
        </div>
      )}

      {loading && (
        <div className="glass-card rounded-xl p-10 text-center text-sm text-muted-foreground">
          Loading sections...
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {sorted.map((s) => {
          if (editingId === s.section_id) {
            return (
              <div
                key={s.section_id}
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
              </div>
            );
          }
          const courseCount = courseCountFor(s);
          return (
            <div
              key={s.section_id}
              className="glass-card rounded-xl p-4 flex items-start justify-between"
            >
              <div className="min-w-0">
                <p className="font-medium">{sectionDisplayName(s)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {courseCount} course{courseCount !== 1 ? "s" : ""}
                </p>
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground mt-1">
                  <Users className="w-3 h-3" /> {s.number_of_students} students
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
                  onClick={() => removeSection(s.section_id)}
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
