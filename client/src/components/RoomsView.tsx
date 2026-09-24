import { useState, useEffect } from "react";
import { Plus, Trash2, Users, Pencil, Check, X, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import { ConfirmDeleteDialog } from "@/components/ConfirmDeleteDialog";

interface Room {
  room_id: number;
  room_number: string;
  capacity: number;
  type: string;
}

interface RoomFormValues {
  room_number: string;
  capacity: number;
  type: string;
}

interface RoomFormProps {
  initial: RoomFormValues;
  onSave: (values: RoomFormValues) => void;
  onCancel: () => void;
}

function RoomForm({ initial, onSave, onCancel }: RoomFormProps) {
  const [roomNumber, setRoomNumber] = useState(initial.room_number);
  const [capacity, setCapacity] = useState(String(initial.capacity));
  const [type, setType] = useState(initial.type);
  const [error, setError] = useState("");

  const handleSave = () => {
    if (!roomNumber.trim()) {
      setError("Room number is required.");
      return;
    }
    const capNum = Number(capacity);
    if (!capacity.trim() || isNaN(capNum) || capNum <= 0) {
      setError("Capacity must be a valid number greater than 0.");
      return;
    }
    setError("");
    onSave({ room_number: roomNumber, capacity: capNum, type });
  };
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <Input
          placeholder="Room Number (e.g. 301)"
          value={roomNumber}
          onChange={(e) => setRoomNumber(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
          }}
        />
        <Input
          type="number"
          placeholder="Capacity"
          value={capacity}
          onChange={(e) => setCapacity(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
          }}
        />
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="Lecture">Lecture</option>
          <option value="Laboratory">Laboratory</option>
        </select>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
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

export function RoomsView() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  const [deleteTarget, setDeleteTarget] = useState<Room | null>(null);

  const emptyRoom: RoomFormValues = {
    room_number: "",
    capacity: 30,
    type: "Lecture",
  };

  const fetchRooms = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/rooms");
      const data = await res.json();
      setRooms(data);
    } catch (err) {
      console.error("Failed to fetch rooms", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  const handleSubmit = async (values: RoomFormValues) => {
    if (!values.room_number) return;
    try {
      await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      setShowForm(false);
      fetchRooms();
    } catch (err) {
      console.error("Failed to create room", err);
    }
  };

  const startEdit = (r: Room) => {
    setEditingId(r.room_id);
    setShowForm(false);
  };

  const saveEdit = async (values: RoomFormValues) => {
    if (!editingId || !values.room_number) return;
    try {
      await fetch(`/api/rooms/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      setEditingId(null);
      fetchRooms();
    } catch (err) {
      console.error("Failed to update room", err);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const removeRoom = async (id: number) => {
    try {
      await fetch(`/api/rooms/${id}`, { method: "DELETE" });
      fetchRooms();
    } catch (err) {
      console.error("Failed to delete room", err);
    }
  };

  const typeColor = (t: string) =>
    t === "Laboratory"
      ? "bg-primary/10 text-primary"
      : "bg-info-light text-info";

  const filtered = rooms.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      r.room_number.toLowerCase().includes(q) ||
      r.type.toLowerCase().includes(q)
    );
  });

  const sorted = [...filtered].sort((a, b) =>
    a.room_number.localeCompare(b.room_number, undefined, { numeric: true }),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold">Rooms</h2>
          <p className="text-muted-foreground mt-1">
            Classrooms and laboratories
          </p>
        </div>
        <Button
          onClick={() => {
            setShowForm(!showForm);
            setEditingId(null);
          }}
        >
          <Plus className="w-4 h-4 mr-1" /> Add Room
        </Button>
      </div>

      <div className="glass-card rounded-xl p-4">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search room number or type…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="glass-card rounded-xl p-5"
          >
            <RoomForm
              initial={emptyRoom}
              onSave={handleSubmit}
              onCancel={() => setShowForm(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {!loading && filtered.length === 0 && !showForm && (
        <div className="glass-card rounded-xl p-10 text-center text-sm text-muted-foreground">
          {rooms.length === 0 ? (
            <>
              No rooms yet. Click <strong>Add Room</strong> to input the rooms
              available in STI Malolos.
            </>
          ) : (
            "No rooms match your search."
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <AnimatePresence mode="popLayout">
          {sorted.map((r, index) => {
            if (editingId === r.room_id) {
              return (
                <motion.div
                  key={r.room_id}
                  layout
                  className="glass-card rounded-xl p-4 ring-2 ring-primary/30 md:col-span-2"
                >
                  <RoomForm
                    initial={{
                      room_number: r.room_number,
                      capacity: r.capacity,
                      type: r.type,
                    }}
                    onSave={saveEdit}
                    onCancel={cancelEdit}
                  />
                </motion.div>
              );
            }
            const stagger = Math.min(index, 8) * 0.05;
            return (
              <motion.div
                key={r.room_id}
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
                <div>
                  <p className="font-medium">{r.room_number}</p>
                  <div className="flex gap-2 mt-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${typeColor(r.type)}`}
                    >
                      {r.type}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="w-3 h-3" /> {r.capacity} seats
                    </span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => startEdit(r)}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteTarget(r)}
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
        title="Delete this room?"
        description={`Are you sure you want to delete ${deleteTarget?.room_number} `}
        onConfirm={() => {
          if (deleteTarget) removeRoom(deleteTarget.room_id);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
