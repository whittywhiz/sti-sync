import { useState, useEffect } from "react";
import {
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  GraduationCap,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";

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

  const handleSave = () => {
    const cleaned = description.trim().replace(/\s+/g, " ");
    if (!cleaned) return;
    onSave(cleaned);
  };

  return (
    <div className="space-y-4">
      <Input
        placeholder="Program name (e.g. BS Information Technology)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSave();
        }}
      />
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave}>
          <Check className="w-4 h-4 mr-1" /> Save
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>
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
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Program | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

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

    const isDuplicate = programs.some(
      (p) => p.description.toLowerCase() === description.toLowerCase(),
    );
    if (isDuplicate) {
      toast.error("A program with this name already exists.");
      return;
    }

    try {
      const res = await fetch("/api/programs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Failed to create program");
        return;
      }
      setShowForm(false);
      fetchAll();
    } catch (err) {
      console.error("Failed to create program", err);
      toast.error("Failed to create program");
    }
  };

  const handleEdit = async (description: string) => {
    if (!editingId || !description) return;

    const isDuplicate = programs.some(
      (p) =>
        p.program_id !== editingId &&
        p.description.toLowerCase() === description.toLowerCase(),
    );
    if (isDuplicate) {
      toast.error("A program with this name already exists.");
      return;
    }

    try {
      const res = await fetch(`/api/programs/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Failed to update program");
        return;
      }
      setEditingId(null);
      fetchAll();
    } catch (err) {
      console.error("Failed to update program", err);
      toast.error("Failed to update program");
    }
  };

  const removeProgram = async (id: number) => {
    try {
      const res = await fetch(`/api/programs/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "Failed to delete program");
        return;
      }
      setSelected((s) => s.filter((x) => x !== id));
      fetchAll();
    } catch (err) {
      console.error("Failed to delete program", err);
      toast.error("Failed to delete program");
    }
  };

  const toggleSelect = (id: number) =>
    setSelected((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : [...s, id],
    );

  const removeSelected = async () => {
    const ids = [...selected];
    const failed: number[] = [];
    let firstError = "";
    for (const id of ids) {
      try {
        const res = await fetch(`/api/programs/${id}`, { method: "DELETE" });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          failed.push(id);
          if (!firstError) firstError = data.error ?? "";
        }
      } catch {
        failed.push(id);
      }
    }
    const deleted = ids.length - failed.length;
    if (deleted > 0) {
      toast.success(`Deleted ${deleted} program${deleted !== 1 ? "s" : ""}`);
    }
    if (failed.length > 0) {
      const names = programs
        .filter((p) => failed.includes(p.program_id))
        .map((p) => p.description)
        .join(", ");
      toast.error(
        `Could not delete ${names}${firstError ? `: ${firstError}` : ""}`,
      );
    }
    setSelected(failed);
    fetchAll();
  };

  const filtered = programs.filter((p) => {
    if (!search) return true;
    return p.description.toLowerCase().includes(search.toLowerCase());
  });

  const sorted = [...filtered].sort((a, b) =>
    a.description.localeCompare(b.description),
  );
  return (
    <div className="space-y-6">
      {/* STICKY HEADER */}
      <div className="sticky top-0 z-50 bg-background pt-4 pb-4 -mx-6 px-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-heading text-2xl font-bold">Programs</h2>
            <p className="text-muted-foreground mt-1">
              Academic programs offered:
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

        <div className="glass-card rounded-xl p-4">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search programs…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setEditingId(null);
              }}
              className="pl-9"
            />
          </div>
        </div>

        {selected.length > 0 && (
          <div className="glass-card rounded-xl mt-3 px-4 py-2 flex items-center justify-between text-sm">
            <span className="font-medium">{selected.length} selected</span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelected(sorted.map((p) => p.program_id))}
              >
                Select all ({sorted.length})
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
            <ProgForm
              initialDescription=""
              onSave={handleAdd}
              onCancel={() => setShowForm(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {!loading && filtered.length === 0 && !showForm && (
        <div className="glass-card rounded-xl p-10 text-center text-sm text-muted-foreground">
          {programs.length === 0 ? (
            <>
              No programs yet. Click <strong>Add Program</strong> to get
              started.
            </>
          ) : (
            "No programs match your search."
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <AnimatePresence mode="popLayout">
          {sorted.map((p, index) => {
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
            const stagger = search ? 0 : Math.min(index, 8) * 0.05;
            const isSelected = selected.includes(p.program_id);
            return (
              <motion.div
                key={p.program_id}
                layout={!search}
                initial={search ? false : { opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{
                  opacity: { duration: 0.2, delay: stagger },
                  y: { duration: 0.2, delay: stagger },
                }}
                className={`glass-card rounded-xl p-4 flex items-start justify-between gap-3 ${
                  isSelected ? "ring-2 ring-primary/40" : ""
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleSelect(p.program_id)}
                  aria-label={`Select ${p.description}`}
                  className="self-center h-4 w-4 shrink-0 cursor-pointer accent-primary"
                />
                <div className="min-w-0 flex-1">
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
                    onClick={() => setDeleteTarget(p)}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <ConfirmDeleteDialog
        open={deleteTarget !== null}
        title="Delete this program?"
        description={`Are you sure you want to delete ${deleteTarget?.description}?`}
        onConfirm={() => {
          if (deleteTarget) removeProgram(deleteTarget.program_id);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmDeleteDialog
        open={bulkDeleteOpen}
        title={`Delete ${selected.length} selected program${selected.length !== 1 ? "s" : ""}?`}
        description="Programs that still have sections can't be deleted and will stay selected."
        onConfirm={() => {
          setBulkDeleteOpen(false);
          removeSelected();
        }}
        onCancel={() => setBulkDeleteOpen(false)}
      />
    </div>
  );
}
