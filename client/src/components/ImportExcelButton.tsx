import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function ImportExcelButton({
  endpoint,
  onDone,
}: {
  endpoint: string;
  onDone: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(endpoint, { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Import failed");
    } else {
      let msg = `Imported ${data.inserted} rows`;
      if (data.skippedAvailability?.length) {
        msg += ` (missing availability: ${data.skippedAvailability.join(", ")})`;
      }
      toast.success(msg);
      onDone();
    }
    e.target.value = "";
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        hidden
        onChange={handleFile}
      />
      <Button variant="outline" onClick={() => inputRef.current?.click()}>
        Import Excel
      </Button>
    </>
  );
}
