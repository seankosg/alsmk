import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Save } from "lucide-react";

export function AdminSettings() {
  const queryClient = useQueryClient();
  const [pmName, setPmName] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["project_settings", "pm_name"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_settings")
        .select("value")
        .eq("key", "pm_name")
        .maybeSingle();
      if (error) throw error;
      return data?.value ?? "";
    },
  });

  useEffect(() => {
    if (data !== undefined) setPmName(data);
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("project_settings")
        .upsert({ key: "pm_name", value: pmName, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project_settings"] });
      toast.success("Settings saved");
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Project Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2 max-w-sm">
          <Label>Project Manager Name</Label>
          <Input
            value={pmName}
            onChange={(e) => setPmName(e.target.value)}
            placeholder="Enter PM name"
            disabled={isLoading}
          />
        </div>
        <Button onClick={() => save.mutate()} disabled={save.isPending || !pmName.trim()}>
          <Save className="h-4 w-4 mr-1" />
          {save.isPending ? "Saving…" : "Save"}
        </Button>
      </CardContent>
    </Card>
  );
}
