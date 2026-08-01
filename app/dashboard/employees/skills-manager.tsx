"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { LoaderCircleIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { EmployeeSkill } from "@/lib/employees/types";

type ManagedSkill = EmployeeSkill & { created_at?: string | null; updated_at?: string | null };

export function SkillsManager({ open, onOpenChange, onChanged }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}) {
  const [skills, setSkills] = useState<ManagedSkill[]>([]);
  const [newSkill, setNewSkill] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [deleteSkill, setDeleteSkill] = useState<ManagedSkill | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSkills = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/org/employee-skills?include_inactive=1", { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as { skills?: ManagedSkill[]; error?: string } | null;
      if (!response.ok) throw new Error(payload?.error ?? "Unable to load skills.");
      setSkills(payload?.skills ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load skills.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      queueMicrotask(() => {
        void loadSkills();
      });
    }
  }, [loadSkills, open]);

  async function addSkill(event: FormEvent) {
    event.preventDefault();
    if (!newSkill.trim()) return;
    setWorkingId("new");
    setError(null);
    try {
      const response = await fetch("/api/org/employee-skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skill_name: newSkill }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error ?? "Unable to add skill.");
      setNewSkill("");
      await loadSkills();
      onChanged();
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : "Unable to add skill.");
    } finally {
      setWorkingId(null);
    }
  }

  async function patchSkill(skillId: string, changes: { skill_name?: string; is_active?: boolean }) {
    setWorkingId(skillId);
    setError(null);
    try {
      const response = await fetch(`/api/org/employee-skills/${skillId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error ?? "Unable to update skill.");
      setEditingId(null);
      await loadSkills();
      onChanged();
    } catch (patchError) {
      setError(patchError instanceof Error ? patchError.message : "Unable to update skill.");
    } finally {
      setWorkingId(null);
    }
  }

  async function confirmDelete() {
    if (!deleteSkill) return;
    setWorkingId(deleteSkill.id);
    setError(null);
    try {
      const response = await fetch(`/api/org/employee-skills/${deleteSkill.id}`, { method: "DELETE" });
      const payload = response.status === 204 ? null : ((await response.json().catch(() => null)) as { error?: string } | null);
      if (!response.ok) throw new Error(payload?.error ?? "Unable to delete skill.");
      setDeleteSkill(null);
      await loadSkills();
      onChanged();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete skill.");
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[85vh] overflow-y-auto rounded-xl sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Manage Skills</DialogTitle>
            <DialogDescription>Add, rename, deactivate, or remove skills for this organization.</DialogDescription>
          </DialogHeader>
          <form className="flex gap-2" onSubmit={addSkill}>
            <Input aria-label="New skill name" placeholder="Add a skill" value={newSkill} onChange={(event) => setNewSkill(event.target.value)} />
            <Button disabled={workingId === "new" || !newSkill.trim()} type="submit">
              {workingId === "new" ? <LoaderCircleIcon className="animate-spin" /> : <PlusIcon />} Add
            </Button>
          </form>
          {error ? <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">{error}</div> : null}
          <div className="divide-y rounded-xl border">
            {isLoading ? <div className="p-5 text-sm text-muted-foreground">Loading skills…</div> : null}
            {!isLoading && skills.length === 0 ? <div className="p-5 text-sm text-muted-foreground">No skills found.</div> : null}
            {skills.map((skill) => (
              <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center" key={skill.id}>
                <div className="min-w-0 flex-1">
                  {editingId === skill.id ? (
                    <Input autoFocus value={editingName} onChange={(event) => setEditingName(event.target.value)} />
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{skill.skill_name}</span>
                      <Badge variant={skill.is_active ? "secondary" : "outline"}>{skill.is_active ? "Active" : "Inactive"}</Badge>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {editingId === skill.id ? (
                    <>
                      <Button size="sm" disabled={workingId === skill.id || !editingName.trim()} onClick={() => void patchSkill(skill.id, { skill_name: editingName })}>Save</Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
                    </>
                  ) : (
                    <>
                      <Button size="icon-sm" variant="ghost" aria-label={`Rename ${skill.skill_name}`} onClick={() => { setEditingId(skill.id); setEditingName(skill.skill_name); }}><PencilIcon /></Button>
                      <Button size="sm" variant="outline" disabled={workingId === skill.id} onClick={() => void patchSkill(skill.id, { is_active: !skill.is_active })}>{skill.is_active ? "Deactivate" : "Activate"}</Button>
                      <Button size="icon-sm" variant="destructive" aria-label={`Delete ${skill.skill_name}`} onClick={() => setDeleteSkill(skill)}><Trash2Icon /></Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(deleteSkill)} onOpenChange={(next) => { if (!next) setDeleteSkill(null); }}>
        <DialogContent className="rounded-xl" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Delete skill?</DialogTitle>
            <DialogDescription>
              {deleteSkill?.skill_name} will be permanently removed from the skill catalogue and from every employee assignment. Deactivation is recommended when historical preservation is useful.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" disabled={Boolean(workingId)} onClick={() => setDeleteSkill(null)}>Cancel</Button>
            <Button variant="destructive" disabled={Boolean(workingId)} onClick={() => void confirmDelete()}>
              {workingId ? <LoaderCircleIcon className="animate-spin" /> : <Trash2Icon />} Delete Skill
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
