import { useState, useEffect } from "react";
import { Plus, Trash2, Clock, Pencil, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";

interface Employee {
  employee_id: number;
  department: string | null;
  lname: string;
  mname: string | null;
  fname: string;
  name: string;
  position: string | null;
  max_hours_per_day: number | null;
  max_hours_per_week: number | null;
}

interface Availability {
  availability_id: number;
  employee_id: number;
  day_id: number;
  start_time: string;
  end_time: string;
}

interface DayRow {
  day_id: number;
  name: string;
}

const SHORT_DAY: Record<string, string> = {
  Monday: "Mon",
  Tuesday: "Tue",
  Wednesday: "Wed",
  Thursday: "Thu",
  Friday: "Fri",
  Saturday: "Sat",
  Sunday: "Sun",
};

function formatTime12hr(time24: string): string {
  const [hStr, mStr] = time24.split(":");
  const hour = parseInt(hStr, 10);
  const minute = (mStr ?? "00").padStart(2, "0");
  const period = hour >= 12 ? "PM" : "AM";
  let h = hour % 12;
  if (h === 0) h = 12;
  return `${h}:${minute} ${period}`;
}

function formatHour12(hour: number): string {
  const period = hour >= 12 ? "PM" : "AM";
  let h = hour % 12;
  if (h === 0) h = 12;
  return `${h}:00 ${period}`;
}

const HOUR_OPTIONS = Array.from({ length: 14 }, (_, i) => i + 7);

interface SlotDraft {
  day_id: number;
  start_hour: number;
  end_hour: number;
}

interface ProfessorFormValues {
  fname: string;
  mname: string;
  lname: string;
  department: string;
  position: string;
  maxHoursPerDay: string;
  maxHoursPerWeek: string;
  slots: SlotDraft[];
}

interface ProfessorFormProps {
  initial: ProfessorFormValues;
  days: DayRow[];
  onSave: (values: ProfessorFormValues) => void;
  onCancel: () => void;
}

function ProfessorForm({
  initial,
  days,
  onSave,
  onCancel,
}: ProfessorFormProps) {
  const [fname, setFname] = useState(initial.fname);
  const [mname, setMname] = useState(initial.mname);
  const [lname, setLname] = useState(initial.lname);
  const [department, setDepartment] = useState(initial.department);
  const [position, setPosition] = useState(initial.position);
  const [maxHoursPerDay, setMaxHoursPerDay] = useState(initial.maxHoursPerDay);
  const [maxHoursPerWeek, setMaxHoursPerWeek] = useState(
    initial.maxHoursPerWeek,
  );
  const [slots, setSlots] = useState<SlotDraft[]>(initial.slots);
  const [selDayId, setSelDayId] = useState<number>(days[0]?.day_id ?? 1);
  const [selStart, setSelStart] = useState(7);
  const [selEnd, setSelEnd] = useState(17);
  const [slotError, setSlotError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const dayName = (id: number) => days.find((d) => d.day_id === id)?.name ?? "";

  const addSlot = () => {
    if (selEnd <= selStart) {
      setSlotError("End time must be after start time.");
      return;
    }
    if (slots.some((s) => s.day_id === selDayId)) {
      setSlotError(
        "That day already has a slot — remove it below first if you want to change it.",
      );
      return;
    }
    setSlotError(null);
    setSlots((s) => [
      ...s,
      { day_id: selDayId, start_hour: selStart, end_hour: selEnd },
    ]);
  };
  const removeSlot = (dayId: number) =>
    setSlots((s) => s.filter((slot) => slot.day_id !== dayId));

  const handleSave = () => {
    if (!fname.trim() || !lname.trim() || !department.trim()) {
      setSaveError("First Name, Last Name, and Department are required.");
      return;
    }

    const dayVal = maxHoursPerDay === "" ? null : Number(maxHoursPerDay);
    const weekVal = maxHoursPerWeek === "" ? null : Number(maxHoursPerWeek);

    if (dayVal != null && (isNaN(dayVal) || dayVal < 0 || dayVal > 24)) {
      setSaveError("Max hours/day must be between 0 and 24.");
      return;
    }
    if (weekVal != null && (isNaN(weekVal) || weekVal < 0 || weekVal > 168)) {
      setSaveError("Max hours/week must be between 0 and 168.");
      return;
    }
    if (dayVal != null && weekVal != null && dayVal > weekVal) {
      setSaveError("Max hours/day can't be greater than max hours/week.");
      return;
    }

    setSaveError(null);
    onSave({
      fname,
      mname,
      lname,
      department,
      position,
      maxHoursPerDay,
      maxHoursPerWeek,
      slots,
    });
  };

  const handleEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSave();
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Input
          placeholder="Department"
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          onKeyDown={handleEnter}
        />
        <Input
          placeholder="Position (optional)"
          value={position}
          onChange={(e) => setPosition(e.target.value)}
          onKeyDown={handleEnter}
        />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Input
          placeholder="First Name"
          value={fname}
          onChange={(e) => setFname(e.target.value)}
          onKeyDown={handleEnter}
        />
        <Input
          placeholder="Middle Name (optional)"
          value={mname}
          onChange={(e) => setMname(e.target.value)}
          onKeyDown={handleEnter}
        />
        <Input
          placeholder="Last Name"
          value={lname}
          onChange={(e) => setLname(e.target.value)}
          onKeyDown={handleEnter}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">
            Max hours/day (optional)
          </label>
          <Input
            type="number"
            min={0}
            max={16}
            step={0.5}
            placeholder="No limit"
            value={maxHoursPerDay}
            onChange={(e) => setMaxHoursPerDay(e.target.value)}
            onKeyDown={(e) => {
              if (["e", "E", "+", "-"].includes(e.key)) e.preventDefault();
              else handleEnter(e);
            }}
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">
            Max hours/week (optional)
          </label>
          <Input
            type="number"
            min={0}
            max={60}
            step={0.5}
            placeholder="No limit"
            value={maxHoursPerWeek}
            onChange={(e) => setMaxHoursPerWeek(e.target.value)}
            onKeyDown={(e) => {
              if (["e", "E", "+", "-"].includes(e.key)) e.preventDefault();
              else handleEnter(e);
            }}
          />
        </div>
      </div>
      <div>
        <p className="text-sm font-medium mb-2">Availability</p>
        <div className="flex gap-2 items-end flex-wrap">
          <select
            value={selDayId}
            onChange={(e) => setSelDayId(+e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            {days.map((d) => (
              <option key={d.day_id} value={d.day_id}>
                {d.name}
              </option>
            ))}
          </select>
          <div className="flex items-center gap-1">
            <select
              value={selStart}
              onChange={(e) => setSelStart(+e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-2 text-sm"
            >
              {HOUR_OPTIONS.map((h) => (
                <option key={h} value={h}>
                  {formatHour12(h)}
                </option>
              ))}
            </select>
            <span className="text-muted-foreground">to</span>
            <select
              value={selEnd}
              onChange={(e) => setSelEnd(+e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-2 text-sm"
            >
              {HOUR_OPTIONS.map((h) => (
                <option key={h} value={h}>
                  {formatHour12(h)}
                </option>
              ))}
            </select>
          </div>
          <Button variant="secondary" size="sm" onClick={addSlot}>
            Add Slot
          </Button>
          {slotError && (
            <p className="text-xs text-destructive mt-1 w-full">{slotError}</p>
          )}
        </div>
        <div className="flex gap-2 mt-2 flex-wrap">
          {slots.map((s) => (
            <Badge
              key={s.day_id}
              variant="secondary"
              className="cursor-pointer"
              onClick={() => removeSlot(s.day_id)}
            >
              {SHORT_DAY[dayName(s.day_id)] ?? dayName(s.day_id)}{" "}
              {formatHour12(s.start_hour)}–{formatHour12(s.end_hour)} ✕
            </Badge>
          ))}
        </div>
      </div>
      {saveError && <p className="text-xs text-destructive">{saveError}</p>}
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

export function ProfessorsView() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [days, setDays] = useState<DayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const emptyForm: ProfessorFormValues = {
    fname: "",
    mname: "",
    lname: "",
    department: "",
    position: "",
    maxHoursPerDay: "",
    maxHoursPerWeek: "",
    slots: [],
  };

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [empRes, availRes, daysRes] = await Promise.all([
        fetch("/api/employees"),
        fetch("/api/availability"),
        fetch("/api/days"),
      ]);
      setEmployees(await empRes.json());
      setAvailability(await availRes.json());
      setDays(await daysRes.json());
    } catch (err) {
      console.error("Failed to fetch professors data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const saveAvailabilityForEmployee = async (
    employeeId: number,
    slots: SlotDraft[],
  ) => {
    const existing = availability.filter((a) => a.employee_id === employeeId);
    await Promise.all(
      existing.map((a) =>
        fetch(`/api/availability/${a.availability_id}`, { method: "DELETE" }),
      ),
    );
    await Promise.all(
      slots.map((s) =>
        fetch("/api/availability", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            employee_id: employeeId,
            day_id: s.day_id,
            start_time: `${String(s.start_hour).padStart(2, "0")}:00`,
            end_time: `${String(s.end_hour).padStart(2, "0")}:00`,
          }),
        }),
      ),
    );
  };

  const handleSubmit = async (values: ProfessorFormValues) => {
    if (!values.fname || !values.lname || !values.department) return;
    try {
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          department: values.department,
          fname: values.fname,
          mname: values.mname || null,
          lname: values.lname,
          position: values.position || null,
          max_hours_per_day:
            values.maxHoursPerDay === "" ? null : Number(values.maxHoursPerDay),
          max_hours_per_week:
            values.maxHoursPerWeek === ""
              ? null
              : Number(values.maxHoursPerWeek),
        }),
      });
      const newEmployee = await res.json();
      await saveAvailabilityForEmployee(newEmployee.employee_id, values.slots);
      setShowForm(false);
      fetchAll();
    } catch (err) {
      console.error("Failed to create professor", err);
    }
  };

  const startEdit = (id: number) => {
    setEditingId(id);
    setShowForm(false);
  };

  const saveEdit = async (values: ProfessorFormValues) => {
    if (!editingId || !values.fname || !values.lname || !values.department)
      return;
    try {
      await fetch(`/api/employees/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          department: values.department,
          fname: values.fname,
          mname: values.mname || null,
          lname: values.lname,
          position: values.position || null,
          max_hours_per_day:
            values.maxHoursPerDay === "" ? null : Number(values.maxHoursPerDay),
          max_hours_per_week:
            values.maxHoursPerWeek === ""
              ? null
              : Number(values.maxHoursPerWeek),
        }),
      });
      await saveAvailabilityForEmployee(editingId, values.slots);
      setEditingId(null);
      fetchAll();
    } catch (err) {
      console.error("Failed to update professor", err);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const removeProfessor = async (id: number) => {
    try {
      await fetch(`/api/employees/${id}`, { method: "DELETE" });
      fetchAll();
    } catch (err) {
      console.error("Failed to delete professor", err);
    }
  };

  const slotsForEmployee = (employeeId: number): SlotDraft[] =>
    availability
      .filter((a) => a.employee_id === employeeId)
      .map((a) => ({
        day_id: a.day_id,
        start_hour: parseInt(a.start_time.split(":")[0], 10),
        end_hour: parseInt(a.end_time.split(":")[0], 10),
      }));

  const dayName = (id: number) => days.find((d) => d.day_id === id)?.name ?? "";

  const sorted = [...employees].sort((a, b) => a.lname.localeCompare(b.lname));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold">Professors</h2>
          <p className="text-muted-foreground mt-1">
            Manage faculty and availability
          </p>
        </div>
        <Button
          onClick={() => {
            setShowForm(!showForm);
            setEditingId(null);
          }}
        >
          <Plus className="w-4 h-4 mr-1" /> Add Professor
        </Button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="glass-card rounded-xl p-5"
          >
            <ProfessorForm
              initial={emptyForm}
              days={days}
              onSave={handleSubmit}
              onCancel={() => setShowForm(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {loading && (
        <div className="glass-card rounded-xl p-10 text-center text-sm text-muted-foreground">
          Loading professors...
        </div>
      )}

      <div className="space-y-3">
        {sorted.map((p) => {
          if (editingId === p.employee_id) {
            return (
              <motion.div
                key={p.employee_id}
                layout
                className="glass-card rounded-xl p-4 ring-2 ring-primary/30"
              >
                <ProfessorForm
                  initial={{
                    fname: p.fname,
                    mname: p.mname ?? "",
                    lname: p.lname,
                    department: p.department ?? "",
                    position: p.position ?? "",
                    maxHoursPerDay:
                      p.max_hours_per_day != null
                        ? String(p.max_hours_per_day)
                        : "",
                    maxHoursPerWeek:
                      p.max_hours_per_week != null
                        ? String(p.max_hours_per_week)
                        : "",
                    slots: slotsForEmployee(p.employee_id),
                  }}
                  days={days}
                  onSave={saveEdit}
                  onCancel={cancelEdit}
                />
              </motion.div>
            );
          }

          return (
            <motion.div
              key={p.employee_id}
              layout
              className="glass-card rounded-xl p-4 flex items-start justify-between"
            >
              <div>
                <p className="font-medium">{p.name}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {p.department}
                  {p.position ? ` • ${p.position}` : ""}
                  {p.max_hours_per_day != null
                    ? ` • Max ${p.max_hours_per_day}hrs/day`
                    : ""}
                  {p.max_hours_per_week != null
                    ? ` • Max ${p.max_hours_per_week}hrs/wk`
                    : ""}
                </p>
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {availability
                    .filter((a) => a.employee_id === p.employee_id)
                    .map((a) => (
                      <span
                        key={a.availability_id}
                        className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full"
                      >
                        <Clock className="w-3 h-3" />
                        {SHORT_DAY[dayName(a.day_id)] ?? dayName(a.day_id)}{" "}
                        {formatTime12hr(a.start_time)}–
                        {formatTime12hr(a.end_time)}
                      </span>
                    ))}
                </div>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => startEdit(p.employee_id)}
                >
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeProfessor(p.employee_id)}
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
