import { useState, useEffect } from "react";
import { Plus, Trash2, Pencil, Check, X, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";

interface Program {
  program_id: number;
  description: string;
}

interface Curriculum {
  curriculum_id: number;
  program_id: number;
}

interface Section {
  section_id: number;
  program_id: number;
}

interface ProgFormProps {
  initialDescription: string;
  onSave: (description: string) => void;
  onCancel: () => void;
}

function ProgForm({ initialDescription, onSave, onCancel }: ProgFormProps) {
  const [description, setDescription] = useState(initialDescription);
  return (
    <div className="space-y-4">
      <Input
        placeholder="Program name (e.g. BS Information Technology)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={() => onSave(description)}>
          <Check className="w-4 h-4 mr-1" /> Save
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          <X className="w-4 h-4 mr-1" /> Cancel
        </Button>
      </div>
    </div>
  );
}

export function ProgramsView() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [curriculums, setCurriculums] = useState<Curriculum[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [programsRes, curriculumRes, sectionsRes] = await Promise.all([
        fetch("/api/programs"),
        fetch("/api/curriculum"),
        fetch("/api/sections"),
      ]);
      setPrograms(await programsRes.json());
      setCurriculums(await curriculumRes.json());
      setSections(await sectionsRes.json());
    } catch (err) {
      console.error("Failed to fetch programs data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const handleAdd = async (description: string) => {
    if (!description) return;
    try {
      await fetch("/api/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });
      setShowForm(false);
      fetchAll();
    } catch (err) {
      console.error("Failed to create program", err);
    }
  };

  const handleEdit = async (description: string) => {
    if (!editingId || !description) return;
    try {
      await fetch(`/api/programs/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });
      setEditingId(null);
      fetchAll();
    } catch (err) {
      console.error("Failed to update program", err);
    }
  };

  const removeProgram = async (id: number) => {
    try {
      await fetch(`/api/programs/${id}`, { method: "DELETE" });
      fetchAll();
    } catch (err) {
      console.error("Failed to delete program", err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold">Programs</h2>
          <p className="text-muted-foreground mt-1">
            Academic programs offered (BSIT, BSCS, etc.)
          </p>
        </div>
        <Button
          onClick={() => {
            setShowForm(!showForm);
            setEditingId(null);
          }}
        >
          <Plus className="w-4 h-4 mr-1" /> Add Program
        </Button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="glass-card rounded-xl p-5"
          >
            <ProgForm
              initialDescription=""
              onSave={handleAdd}
              onCancel={() => setShowForm(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {loading && (
        <div className="glass-card rounded-xl p-10 text-center text-sm text-muted-foreground">
          Loading programs...
        </div>
      )}

      {!loading && programs.length === 0 && !showForm && (
        <div className="glass-card rounded-xl p-10 text-center text-sm text-muted-foreground">
          No programs yet. Click <strong>Add Program</strong> to get started.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[...programs]
          .sort((a, b) => a.description.localeCompare(b.description))
          .map((p) => {
            if (editingId === p.program_id) {
              return (
                <motion.div
                  key={p.program_id}
                  layout
                  className="glass-card rounded-xl p-4 ring-2 ring-primary/30 md:col-span-2"
                >
                  <ProgForm
                    initialDescription={p.description}
                    onSave={handleEdit}
                    onCancel={() => setEditingId(null)}
                  />
                </motion.div>
              );
            }
            const courseCount = curriculums.filter(
              (cu) => cu.program_id === p.program_id,
            ).length;
            const sectionCount = sections.filter(
              (s) => s.program_id === p.program_id,
            ).length;
            return (
              <motion.div
                key={p.program_id}
                layout
                className="glass-card rounded-xl p-4 flex items-start justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-primary" />
                  </div>
                  <p className="font-medium mt-1">{p.description}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {courseCount} courses • {sectionCount} sections
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setEditingId(p.program_id);
                      setShowForm(false);
                    }}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeProgram(p.program_id)}
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
}
